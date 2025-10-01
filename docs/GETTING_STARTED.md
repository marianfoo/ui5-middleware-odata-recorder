# Getting Started with UI5 OData Recorder

A comprehensive guide for developers to build, configure, and use the UI5 OData Recorder toolchain.

## 📋 Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Installation & Setup](#installation--setup)
4. [Project Structure](#project-structure)
5. [Configuration Guide](#configuration-guide)
6. [Common Workflows](#common-workflows)
7. [Advanced Scenarios](#advanced-scenarios)
8. [Troubleshooting](#troubleshooting)

---

## Overview

**UI5 OData Recorder** is a middleware that sits between your UI5 app and backend, recording OData traffic as you click through your application. The recorded data can then be replayed offline using SAP's **FE Mockserver**, enabling development and testing without a live backend.

**Key Benefits:**
- ✅ **Work Offline** - Develop without VPN or backend access
- ✅ **Fast Development** - No backend startup time
- ✅ **Reliable Testing** - Consistent data for automated tests
- ✅ **Multi-Tenant** - Record different data per client/tenant
- ✅ **Zero Code Changes** - Pure middleware configuration

---

## How It Works

### Recording Phase

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Browser   │ ──────> │   UI5 Server     │ ──────> │   Backend   │
│  (Your App) │         │   + Middleware   │         │  (OData API)│
└─────────────┘         └──────────────────┘         └─────────────┘
                                 │
                                 │ Intercepts responses
                                 │ Parses OData JSON
                                 │ Extracts entities
                                 │ Writes to files
                                 ▼
                        webapp/localService/
                          mainService/
                            metadata.xml
                            data/
                              Orders-100.json
                              Customers-100.json
```

**What happens:**
1. Your app makes OData requests (e.g., `/odata/v4/orders/Orders?$expand=customer`)
2. Requests flow through the proxy middleware to your backend
3. **Recorder middleware** intercepts the **responses** (not requests)
4. Middleware decompresses (if gzipped), parses JSON, extracts entities
5. Entities are deduplicated by primary key and written to JSON files
6. Metadata (`$metadata`) is saved automatically

### Replay Phase (FE Mockserver)

```
┌─────────────┐         ┌──────────────────┐
│   Browser   │ ──────> │   UI5 Server     │
│  (Your App) │         │   + FE Mockserver│
└─────────────┘         └──────────────────┘
                                 │
                                 │ Reads from files
                                 ▼
                        webapp/localService/
                          mainService/
                            metadata.xml  ←── Parses schema
                            data/
                              Orders-100.json  ←── Serves entities
                              Customers-100.json
```

**What happens:**
1. Your app makes the same OData requests
2. **SAP FE Mockserver** (`@sap-ux/fe-mockserver-middleware`) intercepts requests
3. Mockserver reads `metadata.xml` to understand entity types and relationships
4. Mockserver loads entities from JSON files (e.g., `Orders-100.json` for tenant `100`)
5. Mockserver simulates OData protocol:
   - Supports `$filter`, `$expand`, `$orderby`, `$top`, `$skip`
   - Handles navigation properties
   - Supports function imports and actions
6. Your app receives responses as if from a real backend

**Key Mockserver Features:**
- **Tenant Isolation:** Uses `?sap-client=100` to select `*-100.json` files
- **Relationship Handling:** Automatically resolves `$expand` from separate JSON files
- **OData Protocol:** Supports V2 and V4 query syntax
- **No Backend:** 100% client-side simulation

**Why This Works:**
The mockserver is **protocol-aware**. It doesn't just serve static files - it understands OData queries and manipulates the data accordingly. For example:

- `Orders?$filter=total gt 100` → Filters in-memory
- `Orders?$expand=customer` → Joins data from `Customers.json`
- `Orders?$orderby=OrderNo desc` → Sorts in-memory

This means your UI5 app doesn't know it's talking to a mock - the behavior is identical to a real OData service!

---

## Installation & Setup

### Prerequisites

- **Node.js** ≥ 20.0.0
- **@ui5/cli** v3.0 or higher
- **Git** (for development)
- A UI5 application with `webapp/manifest.json`

### Option 1: Install from npm (Production)

```bash
# Install CLI globally
npm install -g ui5-odata-recorder

# Install middleware in your UI5 project
cd /path/to/your/ui5-app
npm install --save-dev ui5-middleware-odata-recorder
```

### Option 2: Build from Source (Development)

```bash
# Clone repository
git clone <your-repo-url>
cd ui5-odata-recorder

# Install root dependencies
npm install

# Build the middleware
npm run build

# Link package globally for development (optional)
npm link
```

---

## Project Structure

### Directory Layout

```
ui5-odata-recorder/
├── package.json                    # Main package configuration
├── README.md                       # Quick start guide
├── GETTING_STARTED.md              # This file
├── TESTING_GUIDE.md                # Testing with example app
├── ui5.yaml                        # UI5 extension definition
│
├── lib/
│   └── middleware/
│       └── odataRecorder.js        # Entry point (requires dist/)
│
├── src/                            # TypeScript source
│   ├── middleware/
│   │   └── odataRecorder.ts        # Main middleware
│   ├── utils/
│   │   ├── edmxParser.ts           # Metadata parser
│   │   ├── odataParser.ts          # V2/V4 normalizer
│   │   └── entityMerger.ts         # Deduplication
│   └── types.ts                    # TypeScript types
│
├── dist/                           # Compiled JavaScript
│
├── test/
│   └── orders/                     # Example CAP + Fiori app
│       ├── package.json
│       ├── srv/                    # CAP services
│       ├── db/                     # Data models
│       └── app/
│           └── project1/           # Fiori Elements app
│
└── docs/                           # Detailed documentation
    ├── WORKFLOW.md
    ├── USAGE_GUIDE.md
    ├── PROJECT_SUMMARY.md
    └── ...
```

---

## Configuration Guide

### Understanding the YAML Files

After running `init`, you get two YAML configurations:

#### `ui5.record.yaml` - Recording Mode

```yaml
specVersion: "3.0"
type: application
metadata:
  name: my-app
framework:
  name: SAPUI5
  version: "1.120.0"
server:
  customMiddleware:
    # 1. Proxy forwards requests to backend
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /sap              # Or /odata for CAP
            url: http://localhost:8080

    # 2. Recorder taps responses AFTER proxy
    - name: ui5-middleware-odata-recorder
      afterMiddleware: fiori-tools-proxy  # CRITICAL: Must be after proxy!
      configuration:
        controlEndpoints: true
        autoSave: "onStop"          # or "stream" for immediate writes
        writeMetadata: true
        defaultTenant: "001"
        redact:                     # Optional: strip sensitive fields
          - Password
          - Token
        services:
          - alias: mainService
            version: v4
            basePath: /odata/v4/orders/
            targetDir: webapp/localService/mainService/data
```

**Key Configuration Options:**

| Option | Values | Description |
|--------|--------|-------------|
| `controlEndpoints` | `true`/`false` | Enable `/__recorder/*` REST API |
| `autoSave` | `"onStop"` or `"stream"` | Batch mode (save on stop) vs streaming |
| `writeMetadata` | `true`/`false` | Capture and write `$metadata` |
| `defaultTenant` | string | Tenant ID when not in URL |
| `redact` | string[] | Field names to remove from entities |

#### `ui5.mock.yaml` - Replay Mode

```yaml
specVersion: "3.0"
type: application
metadata:
  name: my-app
framework:
  name: SAPUI5
  version: "1.120.0"
server:
  customMiddleware:
    - name: sap-fe-mockserver
      afterMiddleware: compression
      configuration:
        debug: true
        contextBasedIsolation: true   # Enables tenant-based file selection
        services:
          - urlPath: /odata/v4/orders/
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: false   # Use recorded data only
```

---

## Common Workflows

### Workflow 1: Standalone UI5 App

**Scenario:** You have a standalone UI5 app connecting to a remote OData backend.

```bash
# 1. Navigate to your app
cd /path/to/your/ui5-app

# 2. Initialize recorder
npx ui5-odata-recorder init \
  --backend-url https://your-sap-system.com \
  --tenant 100

# 3. Start recording mode
ui5 serve --config ui5.record.yaml

# 4. In another terminal, control recording
npx ui5-odata-recorder record \
  --tenant 100 \
  --app-url "http://localhost:8080/index.html?sap-ui-xx-viewCache=false" \
  --server-url "http://localhost:8080" \
  --open

# 5. Click through your app, then Ctrl+C

# 6. Start replay mode
ui5 serve --config ui5.mock.yaml

# 7. Open in browser
npx ui5-odata-recorder replay \
  --tenant 100 \
  --app-url "http://localhost:8080/index.html" \
  --open
```

### Workflow 2: CAP Application

**Scenario:** You have a CAP project with one or more Fiori apps.

```bash
# 1. Navigate to your Fiori app
cd /path/to/cap-project/app/yourapp

# 2. Initialize recorder
npx ui5-odata-recorder init

# 3. Add middleware to ui5.yaml
# Edit ui5.yaml and add ui5-middleware-odata-recorder after fiori-tools-proxy

# 4. Start CAP server (it will load the middleware)
cd /path/to/cap-project
cds watch

# 5. In another terminal, control recording
cd /path/to/cap-project/app/yourapp
npx ui5-odata-recorder record \
  --tenant 100 \
  --app-url "http://localhost:4004/yourapp/index.html?sap-ui-xx-viewCache=false" \
  --server-url "http://localhost:4004" \
  --open

# 6. Click through, then Ctrl+C

# 7. For replay: Update CAP's ui5.yaml to use sap-fe-mockserver
# Or use standalone UI5 server with ui5.mock.yaml
```

### Workflow 3: Multi-Tenant Recording

**Scenario:** Record different data for different SAP clients.

```bash
# Record client 100 (e.g., US data)
npx ui5-odata-recorder record --tenant 100 --open
# ... interact with app ...
# Ctrl+C

# Record client 200 (e.g., EU data)
npx ui5-odata-recorder record --tenant 200 --open
# ... interact with app ...
# Ctrl+C

# Files created:
# - Orders-100.json (US orders)
# - Orders-200.json (EU orders)

# Replay US data
npx ui5-odata-recorder replay --tenant 100 --open

# Replay EU data
npx ui5-odata-recorder replay --tenant 200 --open
```

---

## Advanced Scenarios

### Scenario 1: Fetch Metadata Upfront

If your backend requires authentication or is slow, fetch metadata during init:

```bash
npx ui5-odata-recorder init \
  --fetch-metadata \
  --metadata-params "sap-language=EN&sap-value-list=none" \
  --backend-url https://your-sap-system.com
```

This stores `metadata.xml` so you don't need backend access during recording.

### Scenario 2: Stream Mode for Large Sessions

For capturing thousands of entities, use stream mode to write immediately:

```bash
npx ui5-odata-recorder record \
  --tenant 100 \
  --mode stream \
  --open
```

**When to use:**
- Sessions with 10,000+ entities
- Memory-constrained environments
- Long-running recordings

### Scenario 3: Custom Middleware Configuration

For advanced control, manually configure the middleware:

**ui5.yaml:**
```yaml
server:
  customMiddleware:
    - name: ui5-middleware-odata-recorder
      afterMiddleware: fiori-tools-proxy
      configuration:
        controlEndpoints: true
        autoSave: "stream"
        writeMetadata: true
        defaultTenant: "001"
        redact:
          - CreditCardNumber
          - SSN
          - Email
        services:
          # Service 1: OData V4
          - alias: OrdersService
            version: v4
            basePath: /odata/v4/orders/
            targetDir: webapp/localService/OrdersService/data
          
          # Service 2: OData V2
          - alias: LegacyService
            version: v2
            basePath: /sap/opu/odata/SAP/LEGACY_SRV/
            targetDir: webapp/localService/LegacyService/data
```

### Scenario 4: Manual Control via REST API

Programmatically control recording without the CLI:

```javascript
// Start recording
const startResp = await fetch(
  'http://localhost:8080/__recorder/start?tenant=100&mode=onStop'
);
console.log(await startResp.json());
// { status: 'started', tenant: '100', mode: 'onStop' }

// Check status
const statusResp = await fetch('http://localhost:8080/__recorder/status');
console.log(await statusResp.json());
// { active: true, tenant: '100', mode: 'onStop', servicesRecording: 2 }

// Flush buffers (stream mode)
await fetch('http://localhost:8080/__recorder/flush');

// Stop recording
const stopResp = await fetch('http://localhost:8080/__recorder/stop');
console.log(await stopResp.json());
// { status: 'stopped', filesWritten: 5 }
```

### Scenario 5: Integration with Playwright/Puppeteer

Automate recording with browser automation:

```javascript
import { chromium } from 'playwright';

// Start recording via API
await fetch('http://localhost:8080/__recorder/start?tenant=100&mode=onStop');

// Launch browser
const browser = await chromium.launch();
const page = await browser.newPage();

// Navigate with recording flag
await page.goto('http://localhost:8080/index.html?__record=1&sap-client=100');

// Perform actions
await page.click('button#start');
await page.waitForSelector('table#orderList');
await page.click('button#showBooks');
await page.waitForSelector('.booksDialog');

// Stop recording
await fetch('http://localhost:8080/__recorder/stop');

await browser.close();
```

---

## Troubleshooting

### Issue: "manifest.json not found"

**Cause:** Running init from wrong directory.

**Solution:**
```bash
# Ensure you're in the app root (where webapp/ exists)
cd /path/to/your/ui5-app
ls webapp/manifest.json  # Should exist
npx ui5-odata-recorder init
```

### Issue: "No OData services discovered"

**Cause:** manifest.json doesn't have `dataSources` with `type: "OData"`.

**Solution:** Add OData services to manifest:
```json
{
  "sap.app": {
    "dataSources": {
      "mainService": {
        "uri": "/odata/v4/orders/",
        "type": "OData",  // ← Must be exactly "OData"
        "settings": {
          "odataVersion": "4.0"
        }
      }
    }
  }
}
```

### Issue: "Middleware not recording"

**Causes:**
1. Middleware order incorrect (must be AFTER proxy)
2. Service basePath doesn't match
3. Recording not started

**Solutions:**

**1. Check middleware order:**
```yaml
# ✅ Correct
- name: fiori-tools-proxy
- name: ui5-middleware-odata-recorder
  afterMiddleware: fiori-tools-proxy

# ❌ Wrong
- name: ui5-middleware-odata-recorder
- name: fiori-tools-proxy
```

**2. Verify basePath matches:**
```yaml
services:
  - basePath: /odata/v4/orders/  # Must exactly match URL
```

**3. Ensure recording started:**
```bash
# Check status
curl http://localhost:8080/__recorder/status
# Should return: { "active": true, ... }

# Or visit with flag
http://localhost:8080/index.html?__record=1
```

### Issue: "Empty or missing entity files"

**Causes:**
1. Response isn't JSON
2. OData format not recognized
3. EntitySet name mismatch

**Solutions:**

**1. Verify content-type:**
```bash
# Check network tab in DevTools
# Response should be: Content-Type: application/json
```

**2. Check OData format:**
- V2 must have: `{ "d": { "results": [...] } }`
- V4 must have: `{ "value": [...] }`

**3. Verify EntitySet name:**
```xml
<!-- In metadata.xml -->
<EntitySet Name="Orders" EntityType="..."/>
```
URL must use exact name: `/odata/v4/orders/Orders`

### Issue: "Duplicate entities in files"

**Cause:** Metadata wasn't captured (no keys for deduplication).

**Solution:**
1. Ensure `$metadata` request happens first:
   ```bash
   # Refresh app or fetch upfront during init
   npx ui5-odata-recorder init --fetch-metadata
   ```

2. Check console for EDMX parsing errors

3. Verify EntityType has Key definition:
   ```xml
   <EntityType Name="Order">
     <Key>
       <PropertyRef Name="ID"/>
     </Key>
     ...
   </EntityType>
   ```

### Issue: "UI5 server won't start"

**Causes:**
1. @ui5/cli not installed
2. Port conflict
3. Middleware dependency missing

**Solutions:**

**1. Install UI5 CLI:**
```bash
npm install -g @ui5/cli
ui5 --version  # Should show v3.0+
```

**2. Use different port:**
```bash
ui5 serve --config ui5.record.yaml --port 8081
```

**3. Install middleware:**
```bash
npm install --save-dev ui5-middleware-odata-recorder
```

### Issue: "Mockserver 404 errors"

**Cause:** @sap-ux/fe-mockserver-middleware not installed.

**Solution:**
```bash
npm install --save-dev @sap-ux/fe-mockserver-middleware
```

---

## Development Tips

### Watch Mode

During development, use watch mode for hot reloading:

```bash
# Terminal 1: Watch middleware TypeScript compilation
npm run watch

# Terminal 3: Test with app
cd test/orders/app/project1
npx ui5-odata-recorder init
```

### Debugging

Enable debug logs:

```bash
# For middleware
DEBUG=odata-recorder:* ui5 serve --config ui5.record.yaml

# For CLI
DEBUG=ui5-odata-recorder:* npx ui5-odata-recorder record --tenant 100
```

### Inspect Recorded Data

```bash
# Pretty-print JSON
cat webapp/localService/mainService/data/Orders-100.json | jq

# Count entities
cat webapp/localService/mainService/data/Orders-100.json | jq 'length'

# View metadata
cat webapp/localService/mainService/metadata.xml | xmllint --format -
```

---

## Next Steps

✅ **You're ready!** Try these:

1. **Test with sample app:**
   ```bash
   cd test/orders/app/project1
   npx ui5-odata-recorder init
   npm run dev:record -- --tenant 100 --open
   ```

2. **Read detailed guides:**
   - [docs/WORKFLOW.md](docs/WORKFLOW.md) - Step-by-step workflows
   - [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md) - Complete reference
   - [TESTING_GUIDE.md](TESTING_GUIDE.md) - Testing instructions

3. **Explore advanced features:**
   - Multi-service recording
   - Multi-tenant isolation
   - Programmatic control
   - AI/LLM integration

---

**Happy Recording! 🎬**