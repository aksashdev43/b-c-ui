#!/bin/bash
# Run this in Cloud Shell to get your database password

echo "🔐 Getting Database Password from Secret Manager..."
echo ""

# Get the password
PASSWORD=$(gcloud secrets versions access latest --secret="db-password" 2>/dev/null)

if [ -z "$PASSWORD" ]; then
    echo "❌ Failed to get password from Secret Manager"
    echo ""
    echo "Try manually:"
    echo "gcloud secrets versions access latest --secret=db-password"
    exit 1
fi

echo "✅ Password retrieved successfully!"
echo ""
echo "📋 Copy this password:"
echo "================================"
echo "$PASSWORD"
echo "================================"
echo ""
echo "📝 Next steps on your LOCAL machine:"
echo ""
echo "1. Edit .env.local file:"
echo "   nano /Users/krypton/kryptonprojects/UI/beyond-cloud-app-main/.env.local"
echo ""
echo "2. Find this line:"
echo "   DB_PASSWORD=YOUR_DB_PASSWORD_HERE"
echo ""
echo "3. Replace with:"
echo "   DB_PASSWORD=$PASSWORD"
echo ""
echo "4. Save and run:"
echo "   cd /Users/krypton/kryptonprojects/UI/beyond-cloud-app-main"
echo "   npm run dev"
echo ""
echo "🎉 Then your dashboard will work with full sorting and filtering!"
