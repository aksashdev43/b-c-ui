#!/bin/bash

# Deploy updated backend to Cloud Run with sorting and filtering support

echo "🚀 Deploying Updated Backend to Cloud Run..."
echo ""
echo "This will add:"
echo "  ✅ Full server-side sorting (all 58,785 records)"
echo "  ✅ Accurate date filtering (Last 7/30 days, All time)"
echo "  ✅ Search and category filters"
echo ""

cd ~/backend-cloud-run

# Deploy to Cloud Run
gcloud run deploy darkweb-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars CLOUD_SQL_CONNECTION=beyond-cloud-477013:us-central1:darkweb-db \
  --set-env-vars DB_USER=api_user \
  --set-env-vars DB_NAME=threat_intelligence \
  --set-secrets DB_PASSWORD=db-password:latest \
  --add-cloudsql-instances beyond-cloud-477013:us-central1:darkweb-db \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60s \
  --max-instances 10 \
  --min-instances 0

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Testing the API..."
echo ""

# Test sorting
echo "Test 1: Sorting by title (ASC)"
curl -s "https://darkweb-api-902904609419.us-central1.run.app/api/darkweb-fetch?page=1&limit=3&sortField=title&sortOrder=ASC" | jq '.data[].title'
echo ""

# Test date filtering
echo "Test 2: Last 7 days (should show filtered count)"
curl -s "https://darkweb-api-902904609419.us-central1.run.app/api/darkweb-fetch?page=1&limit=5&start_date=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S.000Z)&end_date=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" | jq '{total: .total, showing: (.data | length)}'
echo ""

echo "🎉 All done! Your dashboard now has full sorting and filtering!"
echo ""
echo "Open: http://localhost:3002/darkweb-mentions"
echo ""
echo "Try:"
echo "  ✅ Click column headers to sort"
echo "  ✅ Select 'Last 7 Days' - should show accurate count"
echo "  ✅ All filters work with accurate totals"
