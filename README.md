# ui5-middleware-odata-recorder

🎬 **Record OData traffic from your UI5 app and generate FE-mockserver-compatible datasets**

Perfect for offline development, testing, and creating mock data without backend dependencies.

## ✨ Key Features

- 🔄 **Multi-service & Multi-tenant**: Record from multiple OData services with tenant isolation
- 📊 **Complete Data Capture**: Gets full entities by default (removes `$select` parameters)  
- ⚡ **Smart & Fast**: Deduplication, compression handling, real-time streaming
- 🚫 **304 Prevention**: Automatically removes caching headers to ensure fresh metadata (v0.0.7+)
- 🔧 **Easy Control**: REST API endpoints or URL parameters to start/stop recording
- 📦 **Ready-to-Use**: Generates files compatible with SAP FE Mockserver

## 📦 Installation

```bash
npm install --save-dev ui5-middleware-odata-recorder
```

## ⚙️ Quick Setup

Add to your `ui5.yaml`:

```yaml
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /odata
            url: https://your-backend.com
    
    - name: ui5-middleware-odata-recorder
      afterMiddleware: fiori-tools-proxy
      configuration:
        services:
          - alias: mainService
            version: v4
            basePath: /odata/v4/main/
            targetDir: webapp/localService/mainService/data
```

> 💡 **Tip**: Disable `fiori-tools-appreload` during recording to prevent reload loops

## 🚀 Quick Start

### 1. Start Recording with recordingId

**Using URL parameters (recommended):**

```bash
# Start UI5 server
ui5 serve

# Open browser with recording enabled and recordingId
http://localhost:8080/index.html?__record=1&recordingId=demo

# Or for multi-tenant scenarios
http://localhost:8080/index.html?__record=1&recordingId=100  # SAP client 100
http://localhost:8080/index.html?__record=1&recordingId=200  # SAP client 200
```

**Using REST API:**

```bash
# Start recording with specific recordingId
curl "http://localhost:8080/__recorder/start?recordingId=demo&mode=stream"

# Check recording status
curl "http://localhost:8080/__recorder/status"

# Stop recording and save files
curl "http://localhost:8080/__recorder/stop"
```

### 2. What Gets Recorded

Files are created with recordingId suffix:

```text
webapp/localService/mainService/data/
├── Books-demo.json      ← recordingId: "demo"
├── Orders-demo.json
├── Books-100.json       ← recordingId: "100"  
├── Orders-100.json
└── metadata.xml
```

### 3. Replay with Mockserver

```bash
# Switch to mockserver configuration
ui5 serve --config ui5.mock.yaml

# Open with specific dataset
http://localhost:8080/index.html?recordingId=demo
```

### 4. No recordingId (Simple Mode)

```bash
# Record without recordingId suffix
http://localhost:8080/index.html?__record=1

# Creates clean filenames
webapp/localService/mainService/data/
├── Books.json           ← No suffix
├── Orders.json
└── metadata.xml
```

### 5. Auto-start Configuration

```yaml
configuration:
  autoStart: true
  defaultTenant: "demo"  # Default recordingId if not in URL
```

## 📂 Output

Creates mockserver-compatible files:

```txt
webapp/localService/mainService/
  metadata.xml          # Service metadata
  data/
    Books.json         # Entity data  
    Orders-100.json    # With tenant suffix (if configured)
```

## 🔧 Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `autoStart` | `false` | Start recording when middleware loads |
| `autoSave` | `"stream"` | Write mode: `"stream"` or `"onStop"` |
| `removeSelectParams` | `true` | Remove `$select` to capture full entities |
| `defaultTenant` | `undefined` | Tenant mode: `"100"` or `"getTenantFromSAPClient"` |
| `controlEndpoints` | `true` | Enable `/__recorder/*` REST API |
| `redact` | `[]` | Field names to remove from recorded data |

## 📖 Full Documentation

For detailed guides, advanced features, and troubleshooting:

**[📚 Getting Started Guide →](docs/GETTING_STARTED.md)**

Covers installation, configuration, workflows, and troubleshooting.

**[🎯 recordingId Usage Guide →](docs/RECORDINGID_GUIDE.md)**

Complete guide for multi-dataset recording:

- Multi-tenant SAP client recording
- Test scenario management
- Environment-specific datasets
- REST API control
- Best practices and troubleshooting

## 📄 License

Apache-2.0 © Marian Zeis
