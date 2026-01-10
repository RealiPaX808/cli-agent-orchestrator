#!/bin/bash

echo "=== n8n Webhook Integration Test ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
N8N_URL="http://localhost:5678/webhook-test/optimize-prompt"
BACKEND_URL="http://localhost:9889"
TEST_PROMPT="Write a function to calculate fibonacci numbers"

echo "1. Testing n8n availability..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5678 | grep -q "200"; then
    echo -e "${GREEN}✓${NC} n8n is running"
else
    echo -e "${RED}✗${NC} n8n is not running on port 5678"
    echo "   Start n8n before running this test"
    exit 1
fi

echo ""
echo "2. Testing CAO backend availability..."
if curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Backend is running"
else
    echo -e "${YELLOW}⚠${NC} Backend health check failed (this may be normal if /health endpoint doesn't exist)"
fi

echo ""
echo "3. Testing n8n webhook directly..."
echo "   URL: $N8N_URL"
echo "   Prompt: $TEST_PROMPT"
echo ""

N8N_RESPONSE=$(curl -s -X POST $N8N_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"headers\": {\"content-type\": \"application/json\"},
    \"params\": {},
    \"query\": {},
    \"body\": {\"prompt\": \"$TEST_PROMPT\"},
    \"webhookUrl\": \"$N8N_URL\",
    \"executionMode\": \"test\"
  }" 2>&1)

if echo "$N8N_RESPONSE" | grep -q "optimized_prompt"; then
    echo -e "${GREEN}✓${NC} n8n webhook responded successfully"
    echo "   Response preview: $(echo $N8N_RESPONSE | head -c 100)..."
elif echo "$N8N_RESPONSE" | grep -q "not registered"; then
    echo -e "${RED}✗${NC} n8n webhook is not in listening mode"
    echo ""
    echo "   Action required:"
    echo "   1. Open n8n workflow at http://localhost:5678"
    echo "   2. Click 'Execute Workflow' button"
    echo "   3. Run this test again"
    echo ""
    exit 1
elif echo "$N8N_RESPONSE" | grep -q "Could not resolve host"; then
    echo -e "${RED}✗${NC} Cannot connect to n8n"
    echo "   Make sure n8n is running on port 5678"
    exit 1
else
    echo -e "${YELLOW}⚠${NC} Unexpected response from n8n:"
    echo "   $N8N_RESPONSE"
    echo ""
    echo "   Expected response format: {\"optimized_prompt\": \"...\"}"
fi

echo ""
echo "4. Testing backend /prompt/optimize endpoint..."
echo "   This will fail if no workflow is configured in the dashboard"
echo ""

BACKEND_RESPONSE=$(curl -s -X POST $BACKEND_URL/prompt/optimize \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$TEST_PROMPT\",
    \"webhook_url\": \"$N8N_URL\"
  }" 2>&1)

if echo "$BACKEND_RESPONSE" | grep -q "optimized_prompt"; then
    echo -e "${GREEN}✓${NC} Backend successfully called n8n webhook"
    echo "   Original: $TEST_PROMPT"
    OPTIMIZED=$(echo $BACKEND_RESPONSE | grep -o '"optimized_prompt":"[^"]*"' | cut -d'"' -f4)
    echo "   Optimized: ${OPTIMIZED:0:80}..."
elif echo "$BACKEND_RESPONSE" | grep -q "detail"; then
    echo -e "${RED}✗${NC} Backend returned error:"
    ERROR=$(echo $BACKEND_RESPONSE | grep -o '"detail":"[^"]*"' | cut -d'"' -f4)
    echo "   $ERROR"
else
    echo -e "${YELLOW}⚠${NC} Unexpected backend response:"
    echo "   $BACKEND_RESPONSE"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. Create a workflow in the dashboard (http://localhost:3000/workflows)"
echo "2. Add a webhook node with URL: $N8N_URL"
echo "3. Enable 'Prompt Input' checkbox"
echo "4. Navigate to any session and click 'Prompt Input'"
echo "5. Test the full UI flow"
