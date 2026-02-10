#!/bin/bash

# Deploy Cloud Function with GCS trigger
# This function automatically processes files when uploaded to darkweb-uploads bucket

echo "Deploying Cloud Function..."

gcloud functions deploy processUploadedFile \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=processUploadedFile \
  --trigger-bucket=darkweb-uploads \
  --set-env-vars CLOUD_SQL_CONNECTION=beyond-cloud-477013:us-central1:darkweb-db \
  --set-env-vars DB_USER=api_user \
  --set-env-vars DB_NAME=threat_intelligence \
  --set-secrets DB_PASSWORD=db-password:latest \
  --max-instances=10 \
  --memory=512MB \
  --timeout=540s \
  --service-account=902904609419-compute@developer.gserviceaccount.com

echo "✓ Deployment complete!"
echo ""
echo "The function will now automatically process any XML files uploaded to gs://darkweb-uploads/"
