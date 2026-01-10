# n8n Webhook Integration Test Guide

## Prerequisites

1. **n8n running** on `http://localhost:5678`
2. **Backend running** (`cao-server` on port 9889)
3. **Frontend running** (Next.js on port 3000)

## Setup Steps

### 1. Configure n8n Workflow

1. Open n8n: `http://localhost:5678`
2. Create a new workflow
3. Add a **Webhook** node:
   - **Path**: `optimize-prompt`
   - **Method**: POST
   - **Response Mode**: "Using 'Respond to Webhook' Node"
4. Add your optimization logic (e.g., AI prompt optimization)
5. Add a **Respond to Webhook** node:
   - **Response Body**: JSON
   - **Response Data**:
     ```json
     {
       "optimized_prompt": "{{ your_optimized_prompt_here }}"
     }
     ```
6. **Save and Activate** the workflow
7. Click **Execute Workflow** to enable test mode
8. Copy the webhook URL (should be like: `http://localhost:5678/webhook-test/optimize-prompt`)

### 2. Create Workflow in CAO Dashboard

1. Open dashboard: `http://localhost:3000`
2. Navigate to **Workflows** page
3. Click **Create New Workflow**
4. Add a **Webhook** node:
   - **Webhook URL**: Paste n8n webhook URL from step 1.8
   - **Method**: POST
   - **Enable Prompt Input**: ✅ Check this box
5. Save the workflow

### 3. Test the Integration

#### Manual Test (curl)

```bash
# Test n8n webhook directly
curl -X POST http://localhost:5678/webhook-test/optimize-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "headers": {"content-type": "application/json"},
    "params": {},
    "query": {},
    "body": {"prompt": "Write a function to calculate fibonacci"},
    "webhookUrl": "http://localhost:5678/webhook-test/optimize-prompt",
    "executionMode": "test"
  }'

# Expected response:
# {"optimized_prompt": "...optimized version..."}
```

#### Frontend Test

1. Navigate to any session page: `http://localhost:3000/sessions/cao-Test-Agent`
2. Click **Prompt Input** button
3. Enter test prompt: "Write a function to calculate fibonacci"
4. Click **Optimize with AI**
5. Verify:
   - ✅ n8n workflow executes
   - ✅ Optimized prompt appears in the UI
   - ✅ "Use This Version" button works
   - ✅ "Submit Prompt" sends to session

### 4. Verify Request/Response Flow

**Frontend → Backend:**
```json
POST /api/prompt/optimize
{
  "prompt": "Write a function to calculate fibonacci",
  "webhook_url": "http://localhost:5678/webhook-test/optimize-prompt"
}
```

**Backend → n8n:**
```json
POST http://localhost:5678/webhook-test/optimize-prompt
{
  "headers": {"content-type": "application/json"},
  "params": {},
  "query": {},
  "body": {"prompt": "Write a function to calculate fibonacci"},
  "webhookUrl": "http://localhost:5678/webhook-test/optimize-prompt",
  "executionMode": "production"
}
```

**n8n → Backend:**
```json
{
  "optimized_prompt": "Create a recursive function that efficiently calculates the nth Fibonacci number..."
}
```

**Backend → Frontend:**
```json
{
  "optimized_prompt": "Create a recursive function that efficiently calculates the nth Fibonacci number...",
  "original_prompt": "Write a function to calculate fibonacci"
}
```

## Troubleshooting

### Error: "The requested webhook is not registered"

**Cause**: n8n workflow is not in listening mode.

**Solution**:
1. Open n8n workflow
2. Click **Execute Workflow** button on canvas
3. Webhook is now active for one request in test mode
4. OR: Activate workflow for production mode (webhook always active)

### Error: "Failed to connect to n8n webhook"

**Cause**: n8n is not running or webhook URL is wrong.

**Solution**:
1. Check n8n is running: `curl http://localhost:5678`
2. Verify webhook URL in workflow matches n8n
3. Check n8n logs for errors

### Error: "No webhook configured for prompt input"

**Cause**: No workflow has a webhook node with "Enable Prompt Input" checked.

**Solution**:
1. Create a workflow with a webhook node
2. Configure the webhook URL
3. Check "Enable Prompt Input for this node"
4. Save the workflow

### Optimized prompt is same as original

**Cause**: n8n workflow didn't return `optimized_prompt` field.

**Solution**:
1. Check n8n "Respond to Webhook" node
2. Ensure response contains: `{"optimized_prompt": "..."}`
3. Verify n8n workflow logic is working correctly

## Success Criteria

- [ ] n8n receives webhook request with correct format
- [ ] n8n executes optimization logic
- [ ] n8n returns `{"optimized_prompt": "..."}`
- [ ] Backend receives n8n response
- [ ] Frontend displays optimized prompt
- [ ] User can choose between original and optimized
- [ ] Submit prompt works with final choice

## Notes

- The webhook URL is configured **per workflow** in the dashboard, not as a global environment variable
- Users can have multiple workflows with different n8n webhook URLs
- The "Enable Prompt Input" checkbox determines which webhook is used for prompt optimization
- Only ONE webhook should have "Enable Prompt Input" enabled at a time
