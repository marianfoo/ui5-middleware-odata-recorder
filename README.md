# ui5-middleware-odata-recorder

UI5 custom server middleware to record OData traffic and write FE-mockserver-compatible datasets.

## 🎯 Features

- **Multi-service support**: Record from multiple OData services simultaneously
- **OData V2 & V4**: Automatic version detection and normalization
- **$batch support**: Parses multipart/mixed (V2) and JSON batch (V4)
- **Decompression**: Handles gzip and brotli compression
- **Smart deduplication**: Uses EntityType keys from metadata for merge
- **Multi-tenant**: Isolate recordings by tenant/client ID
- **Control endpoints**: REST API to start/stop/status/flush recording
- **Stream or batch**: Write immediately or buffer until stop
- **Smart duplicate detection**: Only writes files when content actually changes

## 📦 Installation

```bash
npm install --save-dev ui5-middleware-odata-recorder
```

## ⚙️ Configuration

Add to your `ui5.yaml` (or `ui5.record.yaml`):

```yaml
specVersion: "3.0"
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /sap
            url: https://my-backend.com

    # IMPORTANT: Remove or comment out fiori-tools-appreload during recording
    # to prevent infinite reload loops when files are saved
    # - name: fiori-tools-appreload
    #   afterMiddleware: compression
    #   configuration:
    #     port: 35729
    #     path: webapp

    - name: ui5-middleware-odata-recorder
      afterMiddleware: fiori-tools-proxy  # Must be after proxy!
      configuration:
        controlEndpoints: true
        autoSave: "stream"
        autoStart: false               # Optional: start recording immediately
        writeMetadata: true
        # defaultTenant: "100"         # Optional: add tenant suffix to files
        redact: ["Token", "Password"]  # Optional: fields to remove
        services:
          - alias: ODATA_HU_SRV
            version: v2
            basePath: /sap/opu/odata/tgw/ODATA_HU_SRV/
            targetDir: webapp/localService/ODATA_HU_SRV/data
          - alias: ODATA_GENERAL_SRV
            version: v2
            basePath: /sap/opu/odata/TGW/ODATA_GENERAL_SRV/
            targetDir: webapp/localService/ODATA_GENERAL_SRV/data
```

## 🚀 Usage

### Auto-start on page load

Visit your app with `?__record=1`:

```
http://localhost:8080/index.html?__record=1&sap-client=100
```

The middleware will automatically start recording for tenant `100`.

### Auto-start with configuration

Enable `autoStart: true` to begin recording immediately when the middleware loads:

```yaml
- name: ui5-middleware-odata-recorder
  afterMiddleware: fiori-tools-proxy
  configuration:
    autoStart: true              # Start recording immediately
    autoSave: "stream"          # Write files as requests come in
    defaultTenant: "100"        # Record for tenant 100
    services: [...]
```

No manual activation needed - just start your server and recording begins automatically.

> **⚠️ Important**: When recording, make sure to **disable `fiori-tools-appreload`** in your `ui5.record.yaml` to prevent infinite reload loops. The auto-reload middleware triggers when files are saved, causing the app to reload and generate new requests, which saves more files, creating an endless cycle.

### Manual control via HTTP endpoints

Start recording:
```bash
curl "http://localhost:8080/__recorder/start?tenant=100&mode=stream"
```

Check status:
```bash
curl "http://localhost:8080/__recorder/status"
```

Stop and save:
```bash
curl "http://localhost:8080/__recorder/stop"
```

Flush buffers without stopping:
```bash
curl "http://localhost:8080/__recorder/flush"
```

### Suggested npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "record:start": "curl -s 'http://localhost:8080/__recorder/start?tenant=100&mode=stream' | jq",
    "record:stop": "curl -s 'http://localhost:8080/__recorder/stop' | jq",
    "record:status": "curl -s 'http://localhost:8080/__recorder/status' | jq"
  }
}
```

## 📂 Output Structure

### Without Tenant (defaultTenant not specified)
```
webapp/localService/
  mainService/
    metadata.xml              # Auto-captured
    data/
      Books.json              # No tenant suffix
      Orders.json
```

### With Tenant (defaultTenant: "100")  
```
webapp/localService/
  mainService/
    metadata.xml              # Auto-captured
    data/
      Books-100.json          # Tenant suffix added
      Orders-100.json
```

### Multi-Tenant Support

The recorder supports two modes for tenant handling:

**Single Tenant Mode** (default - no `defaultTenant` specified):
- Files: `Books.json`, `Orders.json` 
- Use when you don't need tenant isolation
- Simpler file structure

**Multi-Tenant Mode** (specify `defaultTenant` in config):
- Files: `Books-100.json`, `Orders-100.json`
- Use with SAP systems that have multiple clients
- Tenant can be overridden with `?sap-client=200` in URL
- Enables tenant-specific data isolation

## 🔧 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `controlEndpoints` | boolean | `true` | Enable `/__recorder/*` endpoints |
| `autoSave` | `"stream"` \| `"onStop"` | `"stream"` | When to write files |
| `autoStart` | boolean | `false` | Start recording immediately when middleware loads |
| `writeMetadata` | boolean | `true` | Capture and write `$metadata` |
| `defaultTenant` | string \| undefined | `undefined` | Default tenant for file naming (undefined = no tenant suffix) |
| `redact` | string[] | `[]` | Field names to strip from entities |
| `services` | ServiceConfig[] | `[]` | Services to record |

### ServiceConfig

| Field | Type | Description |
|-------|------|-------------|
| `alias` | string | Service identifier (from manifest) |
| `version` | `"v2"` \| `"v4"` | OData version |
| `basePath` | string | Service root path (e.g., `/sap/opu/odata/tgw/ODATA_HU_SRV/`) |
| `targetDir` | string | Output directory for entity JSON files |

## 🛠️ How It Works

1. **Tap responses**: Intercepts responses from your proxy middleware
2. **Decompress**: Handles gzip/brotli encoding
3. **Parse metadata**: Extracts EntityType keys from EDMX using `@sap-ux/edmx-parser`
4. **Normalize**: Converts OData V2/V4 formats to plain arrays
5. **Extract entities**: Identifies EntitySet from URL, extracts entities from JSON
6. **Merge**: Deduplicates by primary key(s)
7. **Write**: Saves to `webapp/localService/<alias>/data/<EntitySet>-<tenant>.json`

### $batch Processing

The middleware automatically parses batch responses:
- **V2**: multipart/mixed format
- **V4**: JSON batch array

Each item in the batch is processed as a separate entity set.

### Smart Deduplication

Uses entity keys from `$metadata` to merge by primary key:

```typescript
// If HandlingUnits has key "HU_ID"
// Existing: [{ HU_ID: "1", ... }]
// New:      [{ HU_ID: "1", updated: true }, { HU_ID: "2", ... }]
// Result:   [{ HU_ID: "1", ... }, { HU_ID: "2", ... }]
```

Prevents duplicates across multiple recordings to the same file.

## 🔒 Privacy

- Never persists `Authorization` headers or cookies
- Use `redact` to strip sensitive fields from payloads

## 📄 License

Apache-2.0 © Marian Zeis