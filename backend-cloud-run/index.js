const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'api_user',
  database: process.env.DB_NAME || 'threat_intelligence',
  password: process.env.DB_PASSWORD,
  host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION}`,
});

// GET /api/darkweb-fetch - Main endpoint with full sorting and filtering
app.get('/api/darkweb-fetch', async (req, res) => {
  try {
    // Parse parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const category = req.query.category;
    const network = req.query.network;
    const sortField = req.query.sortField || 'date';
    const sortOrder = req.query.sortOrder || 'DESC';
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;
    
    // Search filter
    if (search) {
      whereConditions.push(`(
        title ILIKE $${paramIndex} OR 
        content ILIKE $${paramIndex} OR 
        threat_actors ILIKE $${paramIndex} OR
        victim_organization ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // Category filter
    if (category && category !== 'all') {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }
    
    // Network filter
    if (network && network !== 'all') {
      whereConditions.push(`network = $${paramIndex}`);
      queryParams.push(network);
      paramIndex++;
    }
    
    // Date range filter
    if (startDate && endDate) {
      whereConditions.push(`date >= $${paramIndex} AND date <= $${paramIndex + 1}`);
      queryParams.push(startDate);
      queryParams.push(endDate);
      paramIndex += 2;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    // Validate and sanitize sort parameters
    const allowedSortFields = ['date', 'title', 'category', 'threat_actors', 'victim_country', 'network', 'victim_organization'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'date';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    // Get total count with filters
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM darkweb_mentions 
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated data with sorting
    const dataQuery = `
      SELECT 
        uuid, title, date, category, content,
        victim_country, victim_industry, victim_organization, victim_site,
        threat_actors, network, published_url, screenshots, created_at
      FROM darkweb_mentions
      ${whereClause}
      ORDER BY ${validSortField} ${validSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit);
    queryParams.push(offset);
    
    const dataResult = await pool.query(dataQuery, queryParams);
    
    // Get category stats (filtered)
    const statsQuery = `
      SELECT category, COUNT(*) as count
      FROM darkweb_mentions
      ${whereClause}
      GROUP BY category
    `;
    
    const statsResult = await pool.query(statsQuery, queryParams.slice(0, paramIndex - 1));
    const byCategory = {};
    statsResult.rows.forEach(row => {
      byCategory[row.category] = parseInt(row.count);
    });
    
    res.json({
      success: true,
      data: dataResult.rows,
      total,
      page,
      limit,
      stats: {
        total,
        by_category: byCategory,
      },
    });
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch data',
      message: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
