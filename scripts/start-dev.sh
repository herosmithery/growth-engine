#!/bin/bash
# Growth Engine Dev Launcher
# Starts ngrok + Next.js and auto-configures Vapi webhook URL
set -e

VAPI_API_KEY="056e710a-a47e-41fa-bbe8-bb489104acdb"
VAPI_ASSISTANT_ID="823f2208-47d6-44a7-af02-3b9b7f9581da"
VAPI_PHONE_ID="ce33d019-a0a3-40c5-a850-c473815bd2ed"
ENV_FILE="$(dirname "$0")/../.env.local"

echo "🚀 Growth Engine Dev Launcher"
echo "================================"

# Kill existing processes
pkill -f "next dev" 2>/dev/null || true
pkill ngrok 2>/dev/null || true
sleep 1

# Start Next.js in background
echo "▶  Starting Next.js..."
cd "$(dirname "$0")/.." && npm run dev > /tmp/next-dev.log 2>&1 &
NEXT_PID=$!

# Start ngrok
echo "▶  Starting ngrok tunnel..."
ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
sleep 4

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys,json
d=json.load(sys.stdin)
tunnels=d.get('tunnels',[])
https=[t['public_url'] for t in tunnels if 'https' in t['public_url']]
print(https[0] if https else '')
" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
  echo "❌ Failed to get ngrok URL. Check ngrok is running."
  exit 1
fi

echo "✅ Public URL: $NGROK_URL"

# Update .env.local
sed -i '' "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$NGROK_URL|" "$ENV_FILE"
echo "✅ Updated .env.local with new URL"

WEBHOOK_URL="$NGROK_URL/api/vapi/webhook"

# Update Vapi assistant webhook
echo "▶  Configuring Vapi assistant webhook..."
RESULT=$(curl -s -X PATCH "https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"serverUrl\": \"$WEBHOOK_URL\"}")
echo "✅ Vapi assistant: $(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('serverUrl','error'))" 2>/dev/null)"

# Update Vapi phone number webhook
echo "▶  Configuring Vapi phone number webhook..."
RESULT=$(curl -s -X PATCH "https://api.vapi.ai/phone-number/$VAPI_PHONE_ID" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"serverUrl\": \"$WEBHOOK_URL\"}")
echo "✅ Vapi phone: $(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('serverUrl','error'))" 2>/dev/null)"

# Restart Next.js to pick up new env
echo "▶  Restarting Next.js with new URL..."
kill $NEXT_PID 2>/dev/null || true
sleep 2
cd "$(dirname "$0")/.." && npm run dev > /tmp/next-dev.log 2>&1 &
sleep 6

echo ""
echo "================================"
echo "✅ All systems GO!"
echo ""
echo "  Dashboard:    http://localhost:3000"
echo "  Public URL:   $NGROK_URL"
echo "  Vapi Webhook: $WEBHOOK_URL"
echo ""
echo "📞 Your Vapi number: +19103708465"
echo "   Call it now and the booking will appear in your dashboard."
echo ""
echo "  Logs: tail -f /tmp/next-dev.log"
echo "        tail -f /tmp/ngrok.log"
echo "================================"
