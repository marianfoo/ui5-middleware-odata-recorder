# Testing ui5-odata-recorder

Complete guide to test the recorder middleware with the included test applications.

## 🎯 Goal

Record OData V2 and V4 traffic from Fiori Elements apps (including Books dialog from a second service!) and replay it offline using the FE mockserver.

---

## 📦 Project Structure

This project includes **two complete test applications**:

- **`test/appfev4/`** - Fiori Elements V4 List Report app (OData V4)
- **`test/appfev2/`** - Fiori Elements V2 List Report app (OData V2)
- **`test/orders/`** - CAP backend with OrdersService and BooksService
- **`test/common/`** - Common CAP reuse packages

Both apps demonstrate:
- ✅ Multi-service recording (OrdersService + BooksService)
- ✅ Custom actions (Show Available Books button)
- ✅ Multi-tenant support
- ✅ Batch request handling

---

## Step 1: Build the Middleware Package

```bash
cd /Users/marianzeis/DEV/ui5-odata-recorder

# Build middleware (TypeScript → JavaScript)
npm run build
```

This compiles:
- `src/` → `dist/`

---

## Step 2: Start CAP Backend

The test apps require the CAP backend to be running:

```bash
cd /Users/marianzeis/DEV/ui5-odata-recorder

# Start CAP server (provides both /v2 and /v4 endpoints)
npm run dev:cap
```

**CAP Server provides:**
- `/v2/orders/` - OData V2 OrdersService
- `/v2/books/` - OData V2 BooksService  
- `/v4/orders/` - OData V4 OrdersService
- `/v4/books/` - OData V4 BooksService

Keep this terminal running!

---

## Step 3: Test OData V4 App (appfev4)

### Start Recording Mode

```bash
# In a new terminal
cd /Users/marianzeis/DEV/ui5-odata-recorder

# Start V4 app with recorder
npm run dev:ui5:v4
```

### Open in Browser

Visit: `http://localhost:8080/index.html?__record=1&sap-client=100#/?sap-iapp-state--history=1&sap-iapp-state=2`

**What happens:**
- Middleware auto-starts recording for tenant `100`
- All OData V4 requests are intercepted

### Interact with the App

1. **Click "Go"** - Loads Orders list (records Orders data)
2. **Click "Show Available Books"** - Opens dialog (records Books data from BooksService)
3. **Browse books** - Scroll through the list
4. **Close dialog**
5. **Click on an order** - Navigate to detail view
6. **Check order items** - Navigate to items

**While you interact, watch the terminal** - you'll see:
```
[OData Recorder] ✓ Intercepting GET /v4/orders/Orders for service mainService
[OData Recorder] Captured 2 entities for Orders (tenant: 100)
[OData Recorder] ✓ Intercepting GET /v4/books/Books for service booksService
[OData Recorder] Captured 5 entities for Books (tenant: 100)
```

### Stop Recording

Press `Ctrl+C` in the terminal.

**Generated files in `test/appfev4/webapp/localService/`:**
```
mainService/
  metadata.xml          ← From /v4/orders/$metadata
  data/
    Orders-100.json     ← 2 orders recorded
    Customers-100.json  ← Customer data (from expanded navigation)

booksService/
  metadata.xml          ← From /v4/books/$metadata
  data/
    Books-100.json      ← 5 books recorded (from dialog!)
    Authors-100.json    ← Author data (from expanded navigation)
```

---

## Step 4: Test OData V2 App (appfev2)

### Start Recording Mode

```bash
# In a new terminal
cd /Users/marianzeis/DEV/ui5-odata-recorder

# Start V2 app with recorder
npm run dev:ui5:v2
```

### Open in Browser

Visit: `http://localhost:8080/index.html?__record=1&sap-client=firsttest#/?sap-iapp-state--history=1&sap-iapp-state=2`

**Note:** V2 app uses tenant `firsttest` instead of `100`

### Interact with the App

1. **Click "Go"** - Loads Orders list (records Orders data from V2 endpoint)
2. **Click "Show Available Books"** - Opens dialog (records Books data)
3. **Browse books** - Scroll through
4. **Close dialog**
5. **Click on an order** - Navigate to detail view

**OData V2 Batch Requests:**
- The V2 app sends `$batch` requests (multipart/mixed format)
- Middleware automatically parses and extracts entity sets
- Each batch item is recorded separately

### Stop Recording

Press `Ctrl+C`.

**Generated files in `test/appfev2/webapp/localService/`:**
```
mainService/
  metadata.xml              ← From /v2/orders/$metadata
  data/
    Orders-firsttest.json   ← 2 orders recorded
    Customers-firsttest.json ← Customer data

booksService/
  metadata.xml              ← From /v2/books/$metadata
  data/
    Books-firsttest.json    ← 5 books recorded
```

---

## Step 5: Replay with Mockserver (V4 App)

Now test the recorded data offline using SAP's FE mockserver:

```bash
# Stop the CAP server (Ctrl+C) - we don't need it anymore!
# Stop the recording server (Ctrl+C)

# Start V4 app in mock mode
cd test/appfev4
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=100"
```

**What happens:**
1. `@sap-ux/fe-mockserver-middleware` starts
2. Mockserver loads data from `webapp/localService/*/data/*.json`
3. App works **100% offline** - no backend needed!

### Verify Offline Mode

1. ✅ Click "Go" → Loads from `Orders-100.json`
2. ✅ Click "Show Available Books" → Loads from `Books-100.json`
3. ✅ All data displays exactly as recorded!
4. ✅ Open DevTools Network tab - all requests are intercepted locally

**The CAP server is stopped and the app still works perfectly!**

---

## Step 6: Replay with Mockserver (V2 App)

```bash
# Start V2 app in mock mode
cd test/appfev2
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=firsttest"
```

Same experience - fully offline with your recorded V2 data!

---

## 🧪 Quick Test Script

Run all tests in sequence:

```bash
#!/bin/bash

# Terminal 1: Start CAP backend
cd /Users/marianzeis/DEV/ui5-odata-recorder
npm run dev:cap

# Terminal 2: Test V4 app
cd /Users/marianzeis/DEV/ui5-odata-recorder
npm run build
npm run dev:ui5:v4
# Visit: http://localhost:8080/index.html?__record=1&sap-client=100
# Click through, then Ctrl+C

# Replay V4
cd test/appfev4
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=100"

# Terminal 3: Test V2 app
cd /Users/marianzeis/DEV/ui5-odata-recorder
npm run dev:ui5:v2
# Visit: http://localhost:8080/index.html?__record=1&sap-client=firsttest
# Click through, then Ctrl+C

# Replay V2
cd test/appfev2
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=firsttest"
```

---

## 📊 What Gets Recorded

### OData V4 App (`test/appfev4/`)

| Action | Service | EntitySet | File |
|--------|---------|-----------|------|
| Click "Go" | OrdersService | `Orders` | `Orders-100.json` |
| Expanded customer | OrdersService | `Customers` | `Customers-100.json` |
| Show Books button | BooksService | `Books` | `Books-100.json` |
| Expanded authors | BooksService | `Authors` | `Authors-100.json` |

**Endpoints:**
- `/v4/orders/Orders?$expand=customer,currency` → Orders + Customers
- `/v4/books/Books?$expand=author,currency` → Books + Authors

### OData V2 App (`test/appfev2/`)

| Action | Service | EntitySet | File |
|--------|---------|-----------|------|
| Click "Go" | OrdersService | `Orders` | `Orders-firsttest.json` |
| Expanded customer | OrdersService | `Customers` | `Customers-firsttest.json` |
| Show Books button | BooksService | `Books` | `Books-firsttest.json` |

**Endpoints:**
- `/v2/orders/$batch` → multipart/mixed batch with multiple entity sets
- `/v2/books/Books?$expand=author,currency` → Books data

**Key Difference:** V2 uses `$batch` requests extensively, which are parsed by the middleware into separate entity sets.

---

## 🔍 Inspect Recorded Data

```bash
# V4 App - View recorded orders
cat test/appfev4/webapp/localService/mainService/data/Orders-100.json | jq

# V4 App - View recorded books
cat test/appfev4/webapp/localService/booksService/data/Books-100.json | jq

# V2 App - View recorded orders
cat test/appfev2/webapp/localService/mainService/data/Orders-firsttest.json | jq

# V2 App - View recorded books  
cat test/appfev2/webapp/localService/booksService/data/Books-firsttest.json | jq

# View metadata (V4)
cat test/appfev4/webapp/localService/mainService/metadata.xml | head -30

# View metadata (V2)
cat test/appfev2/webapp/localService/mainService/metadata.xml | head -30
```

---

## 🎯 Expected Results

### V4 Orders (`Orders-100.json`)
```json
[
  {
    "ID": "7e2f2640-6866-4dcf-8f4d-3027aa831cad",
    "OrderNo": "1",
    "buyer": "john.doe@test.com",
    "customer": {
      "ID": "11111111-1111-1111-1111-111111111111",
      "name": "John Smith"
    },
    "currency": {
      "code": "EUR",
      "symbol": "€"
    }
  }
]
```

### V2 Orders (`Orders-firsttest.json`)
```json
[
  {
    "OrderNo": "1",
    "buyer": "john.doe@test.com",
    "ID": "7e2f2640-6866-4dcf-8f4d-3027aa831cad",
    "customer": {
      "name": "John Smith",
      "ID": "11111111-1111-1111-1111-111111111111",
      "__metadata": {
        "type": "sap.capire.orders.api.OrdersService.Customers",
        "uri": "http://localhost:4006/v2/orders/Customers(guid'...')"
      }
    },
    "__metadata": {
      "type": "sap.capire.orders.api.OrdersService.Orders",
      "uri": "http://localhost:4006/v2/orders/Orders(ID=guid'...')"
    }
  }
]
```

**Key Difference:** V2 includes `__metadata` objects which are preserved for mockserver compatibility.

---

## 🚀 Advanced: Multi-Tenant Recording

Record different data for different tenants/clients:

```bash
# Record tenant 100 (V4 app)
npm run dev:ui5:v4
# Visit: http://localhost:8080/index.html?__record=1&sap-client=100
# ... click through, Ctrl+C ...

# Record tenant 200 (V4 app)  
npm run dev:ui5:v4
# Visit: http://localhost:8080/index.html?__record=1&sap-client=200
# ... click through different data, Ctrl+C ...

# Files created:
# - Orders-100.json
# - Orders-200.json
# - Books-100.json
# - Books-200.json

# Replay tenant 100
cd test/appfev4
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=100"

# Replay tenant 200
cd test/appfev4
ui5 serve --config ui5-mock.yaml --open "index.html?sap-client=200"
```

---

## 📸 Verification Checklist

After replay with mockserver, verify:

**V4 App:**
- [ ] Orders list loads (2 orders)
- [ ] Customer names display (John Smith, Maria Garcia)
- [ ] "Show Available Books" button works
- [ ] Books dialog opens with 5 books
- [ ] Stock numbers display correctly
- [ ] Currencies display (EUR symbols)
- [ ] **DevTools Network tab shows NO requests to backend** ✓

**V2 App:**
- [ ] Orders list loads (2 orders)
- [ ] Customer expanded data displays
- [ ] "Show Available Books" button works
- [ ] Books dialog shows data
- [ ] `__metadata` objects preserved in responses
- [ ] **DevTools Network tab shows NO requests to backend** ✓

---

## 🐛 Troubleshooting

### Middleware not building
```bash
cd /Users/marianzeis/DEV/ui5-odata-recorder
npm run build
```

### CAP server won't start
```bash
cd test/orders
npm install
npm run watch
```

### V2 batch requests not recording
- Check middleware logs for "Parsing multipart batch"
- Verify `__metadata.uri` extraction in debug logs
- Ensure `debug: true` in `ui5.record.yaml`

### Recording files empty
- Ensure CAP server is running on port 4006
- Check middleware order in `ui5.record.yaml` (recorder must be AFTER proxy)
- Verify service basePaths match actual URLs
- Enable debug mode: `debug: true` in middleware config

---

## 🎉 Success Criteria

You'll know everything is working when:

1. ✅ Middleware builds successfully (`npm run build`)
2. ✅ CAP server starts and provides V2 + V4 endpoints
3. ✅ Recording mode captures traffic (watch terminal logs)
4. ✅ JSON files are created in `webapp/localService/*/data/`
5. ✅ Metadata files are created in `webapp/localService/*/metadata.xml`
6. ✅ Mockserver replays data without CAP server
7. ✅ **Books dialog works offline with second service!** 🎊
8. ✅ Both V2 and V4 apps work identically

---

## 📚 What You've Tested

After completing this guide, you've verified:

- ✅ **OData V2 Support** - Including batch parsing with `__metadata.uri` extraction
- ✅ **OData V4 Support** - Including JSON batch format
- ✅ **Multi-Service Recording** - Two services recorded simultaneously
- ✅ **Multi-Tenant Support** - Different data for different clients
- ✅ **Smart Deduplication** - Entity keys from metadata prevent duplicates
- ✅ **Custom Actions** - "Show Available Books" button triggers second service
- ✅ **FE Mockserver Integration** - Recorded data replays perfectly offline

---

**Ready to test? Start with Step 1!** 🚀
