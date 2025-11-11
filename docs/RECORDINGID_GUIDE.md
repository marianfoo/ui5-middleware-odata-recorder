# recordingId Usage Guide

A comprehensive guide to using `recordingId` with UI5 OData Recorder for multi-dataset recording and replay.

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Concept Overview](#concept-overview)
3. [URL Parameter Usage](#url-parameter-usage)
4. [Configuration Options](#configuration-options)
5. [REST API Control](#rest-api-control)
6. [File Naming Patterns](#file-naming-patterns)
7. [Common Use Cases](#common-use-cases)
8. [Best Practices](#best-practices)
9. [Advanced Scenarios](#advanced-scenarios)
10. [Troubleshooting](#troubleshooting)

---

## Quick Reference

### Basic Usage

```bash
# Record without recordingId (simple mode)
http://localhost:8080/index.html?__record=1
# → Creates: Books.json, Orders.json

# Record with recordingId (multi-dataset mode)  
http://localhost:8080/index.html?__record=1&recordingId=demo
# → Creates: Books-demo.json, Orders-demo.json

# Replay specific dataset
http://localhost:8080/index.html?recordingId=demo
# → Uses: Books-demo.json, Orders-demo.json
```

### REST API

```bash
# Start recording with recordingId
curl "http://localhost:8080/__recorder/start?recordingId=demo&mode=stream"

# Check current recording status
curl "http://localhost:8080/__recorder/status"

# Stop recording
curl "http://localhost:8080/__recorder/stop"
```

### Configuration

```yaml
# ui5.yaml
configuration:
  defaultTenant: "demo"  # Default recordingId if not specified in URL
  autoStart: true        # Start recording on server startup
```

---

## Concept Overview

### What is recordingId?

The `recordingId` is a **file suffix identifier** that enables you to:

- 🎯 **Separate datasets**: Keep different data recordings isolated
- 🔄 **Switch contexts**: Easily swap between different data scenarios
- 🏢 **Multi-tenant support**: Record data for different SAP clients
- 📊 **Test scenarios**: Maintain datasets for various test cases
- 🚀 **Environment isolation**: Separate dev, test, and demo data

### How It Works

**recordingId becomes part of the filename:**

| recordingId | Entity Set | File Created |
|-------------|------------|--------------|
| `undefined` | Books | `Books.json` |
| `demo` | Books | `Books-demo.json` |
| `100` | Orders | `Orders-100.json` |
| `test-scenario` | Customers | `Customers-test-scenario.json` |

**During replay, the mockserver selects files based on recordingId:**

```bash
# Request with recordingId=100
http://localhost:8080/index.html?recordingId=100
# → Mockserver loads: Orders-100.json, Books-100.json, etc.

# Request with recordingId=demo  
http://localhost:8080/index.html?recordingId=demo
# → Mockserver loads: Orders-demo.json, Books-demo.json, etc.
```

---

## URL Parameter Usage

### Recording Phase

**Basic recording (no recordingId):**
```url
http://localhost:8080/index.html?__record=1
```
- ✅ Simple setup
- ✅ Clean filenames
- ❌ Only one dataset at a time

**Recording with recordingId:**
```url
http://localhost:8080/index.html?__record=1&recordingId=YOUR_ID
```
- ✅ Multiple datasets
- ✅ Isolated contexts
- ✅ Easy dataset switching

### Replay Phase

**Replay without recordingId:**
```url
http://localhost:8080/index.html
```
- Uses files without suffix: `Books.json`, `Orders.json`

**Replay with recordingId:**
```url
http://localhost:8080/index.html?recordingId=YOUR_ID
```
- Uses files with suffix: `Books-YOUR_ID.json`, `Orders-YOUR_ID.json`

### Parameter Validation

✅ **Valid recordingId values:**
- `demo`, `test`, `prod`
- `100`, `200`, `300` (SAP client numbers)
- `scenario1`, `scenario-2`, `test_data`
- `alpha123`, `dev2024`

❌ **Invalid/ignored recordingId values:**
- Empty string: `recordingId=` (falls back to defaultTenant)
- Whitespace only: `recordingId=   ` (treated as undefined)
- Special characters that break file systems

---

## Configuration Options

### 1. URL Parameter (Highest Priority)

```url
http://localhost:8080/index.html?__record=1&recordingId=override
```
- ✅ **Dynamic**: Different recordingId per request
- ✅ **Flexible**: No configuration needed
- ✅ **Override**: Supersedes configuration defaults

### 2. Configuration Default

```yaml
# ui5.yaml
configuration:
  defaultTenant: "demo"  # Used when no recordingId in URL
  autoStart: true        # Optional: start recording on load
```

**Behavior:**
- URL with recordingId: `?recordingId=100` → Uses `100`
- URL without recordingId: (no param) → Uses `demo` (from defaultTenant)
- Empty recordingId: `?recordingId=` → Falls back to `demo`

### 3. No Configuration (Undefined)

```yaml
# ui5.yaml  
configuration:
  # No defaultTenant specified
  autoStart: true
```

**Behavior:**
- URL with recordingId: `?recordingId=100` → Uses `100`
- URL without recordingId: (no param) → No suffix (clean filenames)
- Empty recordingId: `?recordingId=` → No suffix

---

## REST API Control

### Start Recording

```bash
# Start with specific recordingId
curl "http://localhost:8080/__recorder/start?recordingId=demo&mode=stream"

# Start with configuration default
curl "http://localhost:8080/__recorder/start?mode=onStop"

# Response:
{
  "status": "started",
  "recordingId": "demo",
  "mode": "stream"
}
```

### Check Status

```bash
curl "http://localhost:8080/__recorder/status"

# Response:
{
  "active": true,
  "tenant": "demo",           # Current recordingId (kept as 'tenant' for compatibility)
  "mode": "stream", 
  "bufferedKeys": [
    "mainService|demo|Books",
    "mainService|demo|Orders"
  ]
}
```

### Stop Recording

```bash
curl "http://localhost:8080/__recorder/stop"

# Response:
{
  "status": "stopped",
  "itemsWritten": 3
}
```

### Flush Buffers

```bash
# Force write buffers without stopping (useful in 'onStop' mode)
curl "http://localhost:8080/__recorder/flush"

# Response:
{
  "status": "flushed", 
  "itemsWritten": 2
}
```

---

## File Naming Patterns

### Entity Files

| Scenario | recordingId | Entity Set | File Name |
|----------|-------------|------------|-----------|
| Simple mode | `undefined` | Books | `Books.json` |
| Demo data | `demo` | Books | `Books-demo.json` |
| SAP Client 100 | `100` | Orders | `Orders-100.json` |
| Test scenario | `test-v1` | Customers | `Customers-test-v1.json` |

### Metadata Files

Metadata is **shared across all recordingIds**:

```
webapp/localService/mainService/
├── metadata.xml              ← Shared metadata
├── data/
│   ├── Books.json           ← recordingId: undefined
│   ├── Books-demo.json      ← recordingId: demo
│   ├── Books-100.json       ← recordingId: 100
│   ├── Orders.json
│   ├── Orders-demo.json
│   └── Orders-100.json
```

### Directory Structure Example

```
webapp/localService/
├── mainService/
│   ├── metadata.xml
│   └── data/
│       ├── Books-demo.json      ← Demo presentation data
│       ├── Orders-demo.json
│       ├── Books-100.json       ← SAP Client 100
│       ├── Orders-100.json  
│       ├── Books-200.json       ← SAP Client 200
│       ├── Orders-200.json
│       ├── Books-test.json      ← Test data
│       └── Orders-test.json
└── legacyService/
    ├── metadata.xml
    └── data/
        ├── Products-demo.json
        └── Products-100.json
```

---

## Common Use Cases

### 1. SAP Multi-Client Recording

**Scenario**: Record data from different SAP clients (mandants).

```bash
# Record Client 100 (Germany)
http://localhost:8080/index.html?__record=1&recordingId=100

# Record Client 200 (USA)
http://localhost:8080/index.html?__record=1&recordingId=200

# Record Client 300 (UK)
http://localhost:8080/index.html?__record=1&recordingId=300
```

**Files Created:**
```
webapp/localService/mainService/data/
├── Orders-100.json      ← German orders
├── Orders-200.json      ← US orders  
├── Orders-300.json      ← UK orders
├── Customers-100.json   ← German customers
├── Customers-200.json   ← US customers
└── Customers-300.json   ← UK customers
```

**Replay:**
```bash
# Test with German data
http://localhost:8080/index.html?recordingId=100

# Test with US data  
http://localhost:8080/index.html?recordingId=200
```

### 2. Demo vs Development Data

**Scenario**: Separate clean demo data from messy development data.

```bash
# Record clean demo data
http://localhost:8080/index.html?__record=1&recordingId=demo

# Record development test data
http://localhost:8080/index.html?__record=1&recordingId=dev
```

**Usage:**
```bash
# Show clean data to stakeholders
http://localhost:8080/index.html?recordingId=demo

# Use full dataset for development
http://localhost:8080/index.html?recordingId=dev
```

### 3. Test Scenarios

**Scenario**: Different data volumes for testing.

```bash
# Record with empty/minimal data
http://localhost:8080/index.html?__record=1&recordingId=empty

# Record with moderate data
http://localhost:8080/index.html?__record=1&recordingId=medium  

# Record with large dataset
http://localhost:8080/index.html?__record=1&recordingId=large
```

**Automated Testing:**
```javascript
// Test different data volumes
const scenarios = ['empty', 'medium', 'large'];

for (const scenario of scenarios) {
  await page.goto(`http://localhost:8080/index.html?recordingId=${scenario}`);
  await runTests(scenario);
}
```

### 4. User Role Testing

**Scenario**: Record data visible to different user roles.

```bash
# Record as admin user
http://localhost:8080/index.html?__record=1&recordingId=admin

# Record as regular user  
http://localhost:8080/index.html?__record=1&recordingId=user

# Record as guest
http://localhost:8080/index.html?__record=1&recordingId=guest
```

### 5. Environment-Specific Data

**Scenario**: Capture data that simulates different environments.

```bash
# Record production-like data
http://localhost:8080/index.html?__record=1&recordingId=prod-sim

# Record staging data
http://localhost:8080/index.html?__record=1&recordingId=staging

# Record development data  
http://localhost:8080/index.html?__record=1&recordingId=dev-local
```

---

## Best Practices

### 1. Naming Conventions

✅ **Good recordingId naming:**
```bash
demo          # Short, clear
100, 200      # SAP client numbers
test-empty    # Descriptive with context
scenario-1    # Numbered scenarios
dev-2024      # Environment + date
```

❌ **Avoid:**
```bash
x, a, temp    # Too vague
very-long-scenario-name-that-is-hard-to-read  # Too long
test 1        # Spaces (use hyphens/underscores)
```

### 2. Organization Strategy

**By Environment:**
- `dev` - Development data
- `test` - Testing data  
- `demo` - Presentation data
- `prod-sim` - Production simulation

**By Client/Tenant:**
- `100`, `200`, `300` - SAP client numbers
- `tenant-a`, `tenant-b` - Multi-tenant scenarios

**By Data Volume:**
- `empty` - Minimal data
- `small` - Limited dataset  
- `medium` - Moderate dataset
- `large` - Full dataset

**By User Role:**
- `admin` - Administrator view
- `manager` - Manager role data
- `user` - Standard user data
- `guest` - Public/limited data

### 3. Documentation

Document your recordingId strategy:

```markdown
## Dataset Documentation

| recordingId | Description | Use Case |
|-------------|-------------|----------|
| `demo` | Clean presentation data | Sales demos, screenshots |
| `test-empty` | Minimal test data | Edge case testing |
| `test-full` | Complete test dataset | Integration testing |
| `100` | SAP Client 100 (Germany) | Multi-tenant testing |
| `200` | SAP Client 200 (USA) | Regional differences |
```

### 4. Team Guidelines

**For Development Teams:**
- Use descriptive recordingIds: `feature-branch-name`
- Don't commit personal test data: avoid `john-test`, `temp`
- Document datasets in team wiki

**For QA Teams:**
- Standardize test recordingIds: `qa-scenario-1`, `qa-regression`
- Version test data: `qa-v1.0`, `qa-v2.0`
- Include edge cases: `qa-empty`, `qa-error-cases`

---

## Advanced Scenarios

### 1. Programmatic Recording Control

```javascript
// Start recording with specific recordingId
async function startRecording(recordingId, mode = 'stream') {
  const response = await fetch(
    `http://localhost:8080/__recorder/start?recordingId=${recordingId}&mode=${mode}`
  );
  return await response.json();
}

// Record multiple scenarios programmatically
const scenarios = ['demo', 'test-empty', 'test-full'];

for (const scenario of scenarios) {
  await startRecording(scenario);
  await automateDataCollection(scenario);
  await fetch('http://localhost:8080/__recorder/stop');
}
```

### 2. Dynamic recordingId Generation

```javascript
// Generate recordingId based on context
function generateRecordingId() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const branch = process.env.GIT_BRANCH || 'main';
  const user = process.env.USER || 'unknown';
  
  return `${branch}-${date}-${user}`;
}

// Use in automation
const recordingId = generateRecordingId(); // e.g., "feature-auth-2024-01-15-john"
await page.goto(`http://localhost:8080/index.html?__record=1&recordingId=${recordingId}`);
```

### 3. Multi-Service Recording

```yaml
# ui5.yaml - Record multiple services with same recordingId
configuration:
  defaultTenant: "integration-test"
  services:
    - alias: ordersService
      basePath: /odata/v4/orders/
      targetDir: webapp/localService/ordersService/data
    - alias: catalogService  
      basePath: /odata/v4/catalog/
      targetDir: webapp/localService/catalogService/data
```

**Result with recordingId=demo:**
```
webapp/localService/
├── ordersService/data/
│   ├── Orders-demo.json
│   └── Customers-demo.json
└── catalogService/data/
    ├── Products-demo.json
    └── Categories-demo.json
```

### 4. Conditional recordingId

```yaml
# Different defaults per environment
configuration:
  defaultTenant: "${ENVIRONMENT:-dev}"  # Environment variable
  autoStart: true
```

```bash
# Development
export ENVIRONMENT=dev
ui5 serve  # Uses recordingId=dev

# Testing  
export ENVIRONMENT=test
ui5 serve  # Uses recordingId=test
```

### 5. Integration with CI/CD

```yaml
# .github/workflows/record-data.yml
name: Record Test Data

on:
  workflow_dispatch:
    inputs:
      recordingId:
        description: 'Recording ID for dataset'
        required: true
        default: 'ci-test'

jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Start recording
        run: |
          ui5 serve &
          sleep 5
          curl "http://localhost:8080/__recorder/start?recordingId=${{ github.event.inputs.recordingId }}&mode=onStop"
          
      - name: Run automation
        run: npm run test:record
        
      - name: Stop recording
        run: curl "http://localhost:8080/__recorder/stop"
        
      - name: Commit recorded data
        run: |
          git add webapp/localService/
          git commit -m "Update test data: recordingId=${{ github.event.inputs.recordingId }}"
          git push
```

---

## Troubleshooting

### Issue: Wrong Files Being Loaded

**Symptom**: Mockserver loads incorrect data files.

**Causes & Solutions:**

1. **recordingId mismatch:**
   ```bash
   # ❌ Recorded with recordingId=demo
   http://localhost:8080/index.html?__record=1&recordingId=demo
   
   # ❌ But replaying with recordingId=test  
   http://localhost:8080/index.html?recordingId=test
   
   # ✅ Solution: Use same recordingId for replay
   http://localhost:8080/index.html?recordingId=demo
   ```

2. **Files don't exist:**
   ```bash
   # Check if files exist
   ls webapp/localService/mainService/data/
   
   # Should see: Books-demo.json, Orders-demo.json
   # If missing, re-record with correct recordingId
   ```

3. **Case sensitivity:**
   ```bash
   # ❌ Recorded: recordingId=Demo
   # ❌ Replaying: recordingId=demo
   # ✅ Solution: Use exact same case
   ```

### Issue: No recordingId in Files

**Symptom**: Files created without suffix despite using recordingId.

**Check configuration:**
```yaml
# ❌ Possible issue: defaultTenant overriding URL
configuration:
  defaultTenant: ""  # Empty string might cause issues

# ✅ Solution: Use undefined or valid string
configuration:
  # defaultTenant: undefined  # Comment out entirely
  # OR
  defaultTenant: "100"        # Use valid default
```

**Check URL:**
```bash
# ❌ Empty recordingId (falls back to default)
http://localhost:8080/index.html?__record=1&recordingId=

# ✅ Valid recordingId
http://localhost:8080/index.html?__record=1&recordingId=demo
```

### Issue: Files Not Found During Replay

**Symptom**: 404 errors or empty responses during mockserver replay.

**Debug steps:**

1. **Verify file location:**
   ```bash
   # Check expected path
   ls webapp/localService/mainService/data/Books-demo.json
   
   # Verify mockserver configuration
   cat ui5.mock.yaml
   ```

2. **Check mockserver logs:**
   ```bash
   # Enable debug logging
   DEBUG=* ui5 serve --config ui5.mock.yaml
   ```

3. **Verify recordingId parameter:**
   ```bash
   # Check browser URL
   http://localhost:8080/index.html?recordingId=demo
   
   # Check browser DevTools Network tab for recordingId in requests
   ```

### Issue: Mixed recordingId Files

**Symptom**: Some entities have recordingId suffix, others don't.

**Cause**: Recording session was partially done with and without recordingId.

**Solution:**
```bash
# Clean up mixed files
rm webapp/localService/mainService/data/*.json

# Re-record with consistent recordingId
http://localhost:8080/index.html?__record=1&recordingId=demo
```

### Issue: recordingId Not Working with REST API

**Check API calls:**
```bash
# ❌ Missing recordingId parameter
curl "http://localhost:8080/__recorder/start?mode=stream"

# ✅ Include recordingId
curl "http://localhost:8080/__recorder/start?recordingId=demo&mode=stream"

# Verify status
curl "http://localhost:8080/__recorder/status"
# Should show: "tenant": "demo"
```

### Issue: Special Characters in recordingId

**Symptom**: File system errors or broken URLs.

```bash
# ❌ Problematic characters
recordingId="test/data"     # Slash creates subdirectory
recordingId="test data"     # Space breaks URLs
recordingId="test<>data"    # Invalid filename characters

# ✅ Safe characters  
recordingId="test-data"     # Hyphens
recordingId="test_data"     # Underscores
recordingId="testData"      # CamelCase
recordingId="test123"       # Numbers
```

### Debugging Commands

```bash
# Check current recording state
curl -s "http://localhost:8080/__recorder/status" | jq

# List all recorded files
find webapp/localService -name "*.json" | sort

# Show file contents
cat webapp/localService/mainService/data/Books-demo.json | jq

# Check file sizes (detect empty recordings)
ls -la webapp/localService/mainService/data/

# Validate JSON files
for file in webapp/localService/mainService/data/*.json; do
  echo "Checking $file"
  jq empty "$file" && echo "✅ Valid JSON" || echo "❌ Invalid JSON"
done
```

---

## Summary

The `recordingId` feature enables powerful multi-dataset capabilities:

- 🎯 **Dataset Isolation**: Keep recordings separate and organized
- 🔄 **Easy Switching**: Swap between datasets with URL parameters
- 🏢 **Multi-Tenant**: Support different SAP clients seamlessly
- 📊 **Test Scenarios**: Maintain varied test data for different cases
- 🚀 **Flexible Control**: URL, configuration, and API options

**Key Remember Points:**
1. recordingId becomes part of the filename: `EntitySet-recordingId.json`
2. URL parameter takes precedence over configuration default
3. Empty or whitespace recordingId falls back to configuration default
4. Metadata files are shared across all recordingIds
5. Use descriptive, consistent naming conventions
6. Document your recordingId strategy for team clarity

For more examples and advanced usage, see the [Getting Started Guide](GETTING_STARTED.md) and explore the test applications in the `test/` directory.
