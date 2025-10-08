# ui5-middleware-odata-recorder

🎬 **Record OData traffic from your UI5 app and generate FE-mockserver-compatible datasets**

Perfect for offline development, testing, and creating mock data without backend dependencies.

## ✨ Key Features

- 🔄 **Multi-service & Multi-tenant**: Record from multiple OData services with tenant isolation
- 📊 **Complete Data Capture**: Gets full entities by default (removes `$select` parameters)  
- ⚡ **Smart & Fast**: Deduplication, compression handling, real-time streaming
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

## 🚀 Usage

**Start recording with URL parameter:**

```url
http://localhost:8080/index.html?__record=1
```

**Or use REST API:**

```bash
# Start
curl "http://localhost:8080/__recorder/start"

# Stop  
curl "http://localhost:8080/__recorder/stop"
```

**Auto-start on server load:**

```yaml
configuration:
  autoStart: true
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

Covers:

- Multi-tenant recording
- Full entity capture details  
- Advanced configuration scenarios
- Integration with CAP projects
- Troubleshooting common issues

## 📄 License

Apache-2.0 © Marian Zeis