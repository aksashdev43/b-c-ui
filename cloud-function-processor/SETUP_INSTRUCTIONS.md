# Automated File Processing Pipeline Setup

## What This Does

When you upload a file to the GCS bucket `darkweb-uploads`, a Cloud Function automatically:
1. Detects the new file
2. Downloads and parses the XML
3. Processes records in chunks of 100
4. Stores data in Cloud SQL
5. Tracks progress in `processing_jobs` table

## Setup Steps (Run in Cloud Shell)

### 1. Navigate to the directory
```bash
cd ~/cloud-function-processor
```

### 2. Deploy the Cloud Function
```bash
chmod +x deploy.sh
./deploy.sh
```

### 3. Test the setup
```bash
# Upload a test file to trigger the function
gsutil cp /tmp/threat_feed2.xml gs://darkweb-uploads/test-$(date +%s).xml

# Watch the logs in real-time
gcloud functions logs read processUploadedFile --region=us-central1 --gen2 --limit=50
```

## How to Use

### Upload files directly to GCS bucket:
```bash
# From Cloud Shell
gsutil cp your-file.xml gs://darkweb-uploads/

# Or use the web console:
# https://console.cloud.google.com/storage/browser/darkweb-uploads
```

### Check processing status:
```bash
# Query the jobs table
gcloud sql connect darkweb-db --user=api_user --database=threat_intelligence
# Then run: SELECT * FROM processing_jobs ORDER BY created_at DESC LIMIT 10;
```

### Monitor logs:
```bash
# Real-time logs
gcloud functions logs read processUploadedFile --region=us-central1 --gen2 --follow

# Recent logs
gcloud functions logs read processUploadedFile --region=us-central1 --gen2 --limit=100
```

## Frontend Integration

The frontend already auto-refreshes every 5 minutes, so processed data will appear automatically!

You can also add a "Processing Jobs" status page to show upload progress.

## Architecture

```
User uploads file
       ↓
GCS Bucket (darkweb-uploads)
       ↓ (auto-triggers)
Cloud Function (processes in chunks)
       ↓
Cloud SQL (stores data)
       ↓
Frontend (auto-refreshes every 5min)
```

## Benefits

✅ **No size limits** - Processes files of any size
✅ **Automatic** - Just upload to bucket, everything else is handled
✅ **Scalable** - Processes in chunks, won't timeout
✅ **Trackable** - Status stored in `processing_jobs` table
✅ **Fast** - Frontend gets data within 5 minutes
