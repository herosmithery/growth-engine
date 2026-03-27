#!/bin/bash
# Deploy Growth Engine to Vercel and auto-configure all webhooks
# Run once after: vercel login (opens browser)

set -e

VAPI_API_KEY="056e710a-a47e-41fa-bbe8-bb489104acdb"
VAPI_ASSISTANT_ID="823f2208-47d6-44a7-af02-3b9b7f9581da"
VAPI_PHONE_ID="ce33d019-a0a3-40c5-a850-c473815bd2ed"
DIR="$(dirname "$0")/.."

echo "🚀 Deploying Growth Engine to Vercel..."
cd "$DIR"

# Deploy to production
DEPLOY_URL=$(vercel deploy --prod --yes 2>&1 | grep "https://" | tail -1)

if [ -z "$DEPLOY_URL" ]; then
  echo "❌ Deploy failed. Run: vercel login first, then re-run this script."
  exit 1
fi

echo "✅ Deployed: $DEPLOY_URL"

# Update env file
sed -i '' "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$DEPLOY_URL|" "$DIR/.env.local"

# Push env vars to Vercel
echo "▶  Pushing environment variables..."
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  value="${value%%#*}"
  value="${value//\"/}"
  vercel env add "$key" production <<< "$value" 2>/dev/null || true
done < "$DIR/.env.local"

WEBHOOK_URL="$DEPLOY_URL/api/vapi/webhook"

# Configure Vapi webhooks
echo "▶  Configuring Vapi..."
curl -s -X PATCH "https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"serverUrl\": \"$WEBHOOK_URL\"}" > /dev/null

curl -s -X PATCH "https://api.vapi.ai/phone-number/$VAPI_PHONE_ID" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"serverUrl\": \"$WEBHOOK_URL\"}" > /dev/null

echo ""
echo "================================"
echo "✅ DEPLOYED & CONFIGURED!"
echo ""
echo "  Production URL: $DEPLOY_URL"
echo "  Vapi Webhook:   $WEBHOOK_URL"
echo ""
echo "Next steps:"
echo "  1. Set STRIPE_WEBHOOK_SECRET — add $DEPLOY_URL/api/stripe/webhook in Stripe Dashboard"
echo "  2. Set GOOGLE_CLIENT_SECRET — add $DEPLOY_URL/api/google-calendar/callback in Google Console"
echo "  3. Make a call to +19103708465 to test live!"
echo "================================"
