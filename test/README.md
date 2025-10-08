# Unit Tests

This directory contains Jest unit tests for the UI5 OData Recorder middleware utilities.

## Test Coverage

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| **edmxParser.ts** | 91.66% | 71.42% | 100% | 94.73% |
| **entityMerger.ts** | **100%** | **100%** | **100%** | **100%** |
| **odataParser.ts** | 82.60% | 72.85% | 100% | 83.14% |
| **Overall** | **87.67%** | **76.04%** | **100%** | **88.14%** |

## What's Tested

### ✅ EdmxParser (`test/utils/edmxParser.spec.ts`)
- Extracts single primary keys from V2 and V4 metadata
- Extracts composite keys (multi-field primary keys)
- Returns entity type names for entity sets
- Handles unknown entity sets gracefully

### ✅ EntityMerger (`test/utils/entityMerger.spec.ts`)
- Deduplicates entities by single primary key
- Handles composite keys correctly
- Falls back to JSON identity when no keys available
- Redacts sensitive fields (Email, Password, etc.)
- Edge cases: empty arrays, null/undefined values

### ✅ ODataParser (`test/utils/odataParser.spec.ts`)
- **V4 Response Normalization:**
  - Collection responses (`{ value: [...] }`)
  - Single entity responses
  - Objects without value array
- **V2 Response Normalization:**
  - Collection responses (`{ d: { results: [...] } }`)
  - Single entity responses (`{ d: {...} }`)
- **Entity Set Extraction:**
  - From V2 and V4 URLs
  - With key predicates
  - From navigation paths
- **Batch Parsing:**
  - V4 JSON batch format
  - V2 multipart/mixed batch
  - Extraction from `__metadata.uri` (V2 specific)

## What's NOT Tested (Covered by E2E)

The main middleware file (`src/middleware/odataRecorder.ts`) is **excluded from unit tests** because it's fully covered by E2E tests:
- `test/appfev4/` - Fiori Elements V4 app
- `test/appfev2/` - Smart Templates V2 app

E2E tests verify:
- Full recording flow with real UI5 apps
- Multi-service scenarios
- Multi-tenant isolation
- File writing and metadata capture
- FE mockserver replay

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Fixtures

### `fixtures/metadata-v4.xml`
Sample OData V4 metadata with:
- Single key entity (Orders)
- Composite key entity (OrderItems)

### `fixtures/metadata-v2.xml`
Sample OData V2 metadata with same structure

## Adding New Tests

When adding new utility functions:

1. Create `test/utils/yourUtil.spec.ts`
2. Import the utility: `import { YourUtil } from '../../src/utils/yourUtil';`
3. Write describe blocks for each major function
4. Aim for 80%+ coverage
5. Run `npm run test:coverage` to verify

Example test structure:
```typescript
describe('YourUtil', () => {
  describe('mainFunction', () => {
    it('should handle normal case', () => {
      const result = YourUtil.mainFunction(input);
      expect(result).toEqual(expected);
    });

    it('should handle edge case', () => {
      // Test edge case
    });
  });
});
```

## CI Integration

Tests run automatically on:
- Pre-commit (if git hooks configured)
- CI/CD pipeline (GitHub Actions, etc.)
- Before npm publish

Minimum coverage thresholds (enforced by Jest):
- Statements: 80%
- Branches: 70%
- Functions: 70%
- Lines: 80%


