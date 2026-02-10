const { Storage } = require('@google-cloud/storage');
const { Pool } = require('pg');
const { XMLParser } = require('fast-xml-parser');

const storage = new Storage();

// Database connection pool
const pool = new Pool({
  host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION}`,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  max: 5,
});

/**
 * Cloud Function triggered by GCS file upload
 * Processes XML threat intelligence files in chunks
 */
exports.processUploadedFile = async (file, context) => {
  const fileName = file.name;
  const bucketName = file.bucket;
  
  console.log(`Processing file: ${fileName} from bucket: ${bucketName}`);
  
  try {
    // Create job tracking record
    const jobId = await createJob(fileName, 'processing');
    
    // Download and process file in stream
    const bucket = storage.bucket(bucketName);
    const fileHandle = bucket.file(fileName);
    
    // Download file content
    const [fileContent] = await fileHandle.download();
    const xmlContent = fileContent.toString('utf-8');
    
    console.log(`File size: ${(fileContent.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    
    const parsed = parser.parse(xmlContent);
    let messages = [];
    
    // Extract messages from XML structure
    if (parsed.threat_feed?.messages?.message) {
      messages = Array.isArray(parsed.threat_feed.messages.message)
        ? parsed.threat_feed.messages.message
        : [parsed.threat_feed.messages.message];
    }
    
    console.log(`Found ${messages.length} messages to process`);
    
    // Process in chunks of 100 records
    const CHUNK_SIZE = 100;
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const result = await processChunk(chunk);
      
      processed += result.success;
      skipped += result.skipped;
      failed += result.failed;
      
      // Update job progress
      const progress = Math.floor(((i + chunk.length) / messages.length) * 100);
      await updateJobProgress(jobId, progress, processed, skipped, failed);
      
      console.log(`Progress: ${progress}% (${processed} processed, ${skipped} skipped, ${failed} failed)`);
    }
    
    // Mark job as completed
    await updateJob(jobId, 'completed', processed, skipped, failed);
    
    console.log(`✓ Complete! Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
    
    return { success: true, processed, skipped, failed };
    
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
};

/**
 * Process a chunk of records
 */
async function processChunk(records) {
  const client = await pool.connect();
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      try {
        const data = {
          uuid: record.uuid || generateUUID(),
          message: record.message || '',
          category: record.category || 'unknown',
          network: record.network || 'unknown',
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          metadata: JSON.stringify(record),
        };
        
        // Insert with conflict handling
        const result = await client.query(`
          INSERT INTO darkweb_mentions (uuid, message, category, network, timestamp, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (uuid) DO NOTHING
          RETURNING uuid
        `, [data.uuid, data.message, data.category, data.network, data.timestamp, data.metadata]);
        
        if (result.rowCount > 0) {
          success++;
        } else {
          skipped++; // Duplicate
        }
      } catch (err) {
        console.error('Error inserting record:', err.message);
        failed++;
      }
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Chunk processing error:', error);
    failed += records.length;
  } finally {
    client.release();
  }
  
  return { success, skipped, failed };
}

/**
 * Create job tracking record
 */
async function createJob(fileName, status) {
  const client = await pool.connect();
  try {
    // Create jobs table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS processing_jobs (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        progress INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const result = await client.query(
      'INSERT INTO processing_jobs (file_name, status) VALUES ($1, $2) RETURNING id',
      [fileName, status]
    );
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Update job progress
 */
async function updateJobProgress(jobId, progress, processed, skipped, failed) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE processing_jobs SET progress = $1, processed = $2, skipped = $3, failed = $4, updated_at = NOW() WHERE id = $5',
      [progress, processed, skipped, failed, jobId]
    );
  } finally {
    client.release();
  }
}

/**
 * Update job status
 */
async function updateJob(jobId, status, processed, skipped, failed) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE processing_jobs SET status = $1, progress = 100, processed = $2, skipped = $3, failed = $4, updated_at = NOW() WHERE id = $5',
      [status, processed, skipped, failed, jobId]
    );
  } finally {
    client.release();
  }
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
