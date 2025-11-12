# Changelog: Expanded Navigation Support for OData V2 & V4

**Date**: November 12, 2025  
**Version**: 0.0.9  
**Type**: Bug Fixes & Feature Enhancements

---

## Overview

This changelog documents comprehensive improvements to the OData Recorder middleware for handling expanded navigation properties in both OData V2 and V4 responses. Two critical bugs were identified and fixed, enabling full support for extracting expanded entities to separate files with proper foreign key relationships.

---

## 🐛 Bug Fix #1: Single-Entity Navigation Detection (V4)

### Issue
Expanded single-entity navigations (e.g., `Orders?$expand=customer`) were not being extracted to separate files, even when referential constraints existed in the metadata.

### Symptoms
- ✅ Collection navigations (`Orders?$expand=Items`) worked correctly
- ❌ Single-entity navigations (`Orders?$expand=customer`) were not extracted
- ❌ `Customers.json` file was not created
- ❌ Mock mode failed because mockserver couldn't resolve the `customer` navigation

### Root Cause
The detection logic in `src/utils/odataParser.ts` used an incorrect condition to identify single-entity navigations:

```typescript
// BUGGY CODE
if (typeof value === 'object' && value !== null && !value['@odata.context']) {
  // Single entity navigation
  expansions.push({ navProperty: key, entities: [value] });
}
```

The condition `!value['@odata.context']` was too restrictive because:
- OData V4 includes `@odata.context` in expanded entities
- This caused single-entity navigations to be skipped

### Solution
Changed the detection to check for `@odata.id` instead:

```typescript
// FIXED CODE
if (typeof value === 'object' && value !== null && '@odata.id' in value) {
  // Single entity navigation - check for @odata.id which is present in expanded entities
  expansions.push({ navProperty: key, entities: [value] });
}
```

**Why this works:**
- `@odata.id` is a standard OData V4 property containing the canonical URL of an entity
- It's present in **all** expanded entities (both single and collection items)
- It reliably distinguishes entity objects from complex types

### Files Changed
- `src/utils/odataParser.ts`: Fixed single-entity navigation detection logic

### Testing Results
- ✅ `Customers.json` now created with 2 customer entities
- ✅ Mock mode works correctly for single-entity navigations
- ✅ All 128 unit tests pass

---

## 🐛 Bug Fix #2: OData V2 Foreign Key Enrichment

### Issue
When recording OData V2 responses with expanded navigations, foreign key fields (e.g., `customer_ID`) were sometimes missing from the parent entity, causing mock mode to fail.

### Symptoms
- ✅ V4 responses always included foreign keys
- ❌ V2 responses sometimes included foreign keys, sometimes didn't
- ❌ Mock mode failed when foreign keys were missing
- ❌ Backend-dependent behavior: some OData V2 backends include FKs when navigations are expanded, others don't

### Example Problem

**V2 Response WITHOUT foreign key (problematic):**
```json
{
  "ID": "64e718c9-ff99-47f1-8ca3-950c850777d4",
  "OrderNo": "2",
  "customer": {
    "ID": "22222222-2222-2222-2222-222222222222",
    "name": "Maria Garcia"
  }
  // ❌ NO customer_ID field!
}
```

**V2 Response WITH foreign key (works):**
```json
{
  "ID": "64e718c9-ff99-47f1-8ca3-950c850777d4",
  "OrderNo": "2",
  "customer_ID": "22222222-2222-2222-2222-222222222222",  // ✅ FK present
  "customer": {
    "ID": "22222222-2222-2222-2222-222222222222",
    "name": "Maria Garcia"
  }
}
```

### Root Cause
In OData V2, when a navigation property is expanded, the backend **may or may not** include the foreign key field. This is implementation-specific:

- **SAP CAP backends**: Include foreign keys even when navigations are expanded
- **Some other V2 backends**: Omit foreign keys (assuming client doesn't need them since full entity is present)

The recorder was extracting expanded entities to separate files but not ensuring the foreign key remained in the parent entity.

### Solution
Enhanced the foreign key enrichment logic to work **bidirectionally**:

1. **Parent → Child enrichment** (existing): If child entity is missing a foreign key, inject it from parent
2. **Child → Parent enrichment** (NEW): If parent entity is missing a foreign key, inject it from first child entity

```typescript
// ENHANCED CODE
if (config.enrichForeignKeys && parser) {
  const constraints = parser.getReferentialConstraints(entitySet, expansion.navProperty);
  if (constraints.length > 0) {
    for (const constraint of constraints) {
      // NEW: If parent is missing the source property (foreign key), inject it from first child
      if (!(constraint.sourceProperty in entity) && expansion.entities.length > 0) {
        const firstChild = expansion.entities[0];
        if (constraint.targetProperty in firstChild) {
          entity[constraint.sourceProperty] = firstChild[constraint.targetProperty];
          debug(`[TRACE] Enriched parent FK: ${constraint.sourceProperty} = ${firstChild[constraint.targetProperty]}`);
        }
      }
      
      // EXISTING: Also enrich children if they're missing the target property
      for (const childEntity of expansion.entities) {
        if (!(constraint.targetProperty in childEntity) && constraint.sourceProperty in entity) {
          childEntity[constraint.targetProperty] = entity[constraint.sourceProperty];
          debug(`[TRACE] Enriched child FK: ${constraint.targetProperty} = ${entity[constraint.sourceProperty]}`);
        }
      }
    }
  }
}
```

### How It Works
For navigation `Orders -> customer` with constraint `Orders.customer_ID -> Customers.ID`:

1. **Check parent**: Does the Order have `customer_ID`?
   - If NO: Extract it from expanded customer entity (`customer.ID`)
   - If YES: Keep existing value

2. **Check children**: Do Customer entities have the key?
   - Usually yes for V2, but checked for completeness

### Files Changed
- `src/middleware/odataRecorder.ts`: Enhanced foreign key enrichment logic

### Testing Results
- ✅ `Orders.json` now includes `customer_ID` and `currency_code` fields
- ✅ Mock mode works correctly for V2 apps with expanded navigations
- ✅ Works regardless of backend implementation
- ✅ All 128 unit tests pass

---

## 🎁 Bonus Fix: Metadata Writing During Proactive Load

### Issue
Metadata files were not being written during proactive metadata loading at startup.

### Solution
Added `writeMetadata` call in the `loadMetadataForService` function:

```typescript
// Parse and cache
const parser = new EdmxParser();
await parser.parse(xmlData);
parsers.set(service.alias, parser);
runtime.metadataCache.set(service.alias, xmlData);

// Write metadata to disk if configured (NEW)
if (config.writeMetadata) {
  await writeMetadata(service.alias, xmlData, config);
}
```

### Result
- ✅ `metadata.xml` files are now reliably created during startup
- ✅ Mock server can start without errors

### Files Changed
- `src/middleware/odataRecorder.ts`: Added metadata writing during proactive load

---

## 📋 Configuration Options

### Expanded Navigation Strategy

Three strategies are now supported:

```yaml
# ui5.record.yaml
configuration:
  expandedNavigationStrategy: 'auto' # default - RECOMMENDED
  # Options:
  # 'auto' - Extract to separate files only when referential constraints exist
  # 'always-separate' - Always extract (regardless of constraints)
  # 'always-inline' - Always keep inline (never extract)
  
  enrichForeignKeys: true # default - Enable bidirectional FK enrichment
```

### Warning Messages

When using `'auto'` mode, warnings appear if constraints are missing:

```
[OData Recorder] ⚠️ Navigation 'Items' in 'Orders' has no referential constraints - keeping inline data
[OData Recorder] 💡 To enable separate file extraction, add referential constraints to your metadata
```

---

## 🔍 Understanding Referential Constraints

### OData V4 - Direct Constraints (Single Entity)

```xml
<EntityType Name="Orders">
  <NavigationProperty Name="customer" Type="Namespace.Customers">
    <ReferentialConstraint Property="customer_ID" ReferencedProperty="ID"/>
  </NavigationProperty>
  <Property Name="customer_ID" Type="Edm.Guid"/>
</EntityType>
```

### OData V4 - Partner Constraints (Collections)

```xml
<!-- Parent entity -->
<EntityType Name="Orders">
  <NavigationProperty Name="Items" Type="Collection(Namespace.Orders_Items)" Partner="up_"/>
</EntityType>

<!-- Child entity (constraint is here) -->
<EntityType Name="Orders_Items">
  <NavigationProperty Name="up_" Type="Namespace.Orders" Partner="Items">
    <ReferentialConstraint Property="up__ID" ReferencedProperty="ID"/>
  </NavigationProperty>
  <Property Name="up__ID" Type="Edm.Guid" Nullable="false"/>
</EntityType>
```

### OData V2 - Association Constraints

```xml
<Association Name="Orders_customer">
  <End Type="Namespace.Orders" Multiplicity="*" Role="Orders"/>
  <End Type="Namespace.Customers" Multiplicity="0..1" Role="Customers"/>
  <ReferentialConstraint>
    <Principal Role="Customers">
      <PropertyRef Name="ID"/>
    </Principal>
    <Dependent Role="Orders">
      <PropertyRef Name="customer_ID"/>
    </Dependent>
  </ReferentialConstraint>
</Association>
```

---

## 🧪 Testing Summary

### Automated Tests
- **Test Suites**: 5 passed, 5 total
- **Tests**: 128 passed, 128 total
- **Coverage**: All existing functionality preserved

### Manual Testing - OData V4

#### Recording Mode
1. ✅ `Orders.json` created with 2 orders (without expanded data)
2. ✅ `Orders_Items.json` created with 3 items
3. ✅ `Customers.json` created with 2 customers
4. ✅ `metadata.xml` files created for both services
5. ✅ Foreign keys preserved in all entities

#### Mock Mode
1. ✅ Data loaded correctly from separate files
2. ✅ Mockserver resolved `customer` navigation using referential constraints
3. ✅ Mockserver resolved `Items` navigation using partner constraints
4. ✅ Dialog displayed correct customer names and item details

### Manual Testing - OData V2

#### Recording Mode
1. ✅ Backend sent responses WITHOUT `customer_ID` and `currency_code`
2. ✅ Recorder enriched parent Orders with foreign keys from expanded entities
3. ✅ `Orders.json` created with correct `customer_ID` and `currency_code` fields
4. ✅ `Customers.json` and `Currencies.json` created with expanded entities
5. ✅ `metadata.xml` files created for both services

#### Mock Mode
1. ✅ Data loaded correctly from separate files
2. ✅ Mockserver resolved `customer` and `currency` navigations using foreign keys
3. ✅ Dialog displayed correct customer names and currency symbols

---

## 📊 Impact Summary

### What Works Now

| Feature | V4 | V2 | Status |
|---------|----|----|--------|
| Single-entity navigation extraction | ✅ | ✅ | Fixed |
| Collection navigation extraction | ✅ | ✅ | Working |
| Foreign key enrichment (parent) | ✅ | ✅ | Enhanced |
| Foreign key enrichment (child) | ✅ | ✅ | Working |
| Metadata writing on startup | ✅ | ✅ | Fixed |
| Mock mode with separate files | ✅ | ✅ | Working |
| Deferred navigation handling | ✅ | ✅ | Working |
| Referential constraint detection | ✅ | ✅ | Working |

### Breaking Changes
- **None**: All existing functionality preserved
- **Backward Compatible**: Default behavior unchanged

### Performance Impact
- **Negligible**: Only adds FK enrichment checks when `enrichForeignKeys: true` (default)
- **Metadata writing**: One-time operation during startup

---

## 📝 Demo Applications

### OData V4 Demo (`test/appfev4`)

**Demo Buttons:**
1. **"Demo: Order + Items"**: Tests collection navigation extraction
2. **"Demo: Orders + Items + Customer"**: Tests multiple expanded navigations

**Files Created:**
- `Orders.json` - Parent entities without expanded data
- `Orders_Items.json` - Extracted items
- `Customers.json` - Extracted customers

### OData V2 Demo (`test/appfev2`)

**Demo Buttons:**
1. **"Demo: Customer + Orders"**: Tests collection navigation (backend limitation: Customers has no Orders navigation)
2. **"Demo: Orders + Customer"**: Tests single-entity navigation with FK enrichment
3. **"Demo: Deferred Nav"**: Tests that deferred links are not extracted

**Files Created:**
- `Orders.json` - Parent entities with enriched foreign keys
- `Customers.json` - Extracted customers
- `Currencies.json` - Extracted currencies

---

## 🔧 Debugging

Enable debug mode for detailed trace logs:

```yaml
# ui5.record.yaml
configuration:
  debug: true
```

**Example Debug Output:**
```
[TRACE] Navigation targets for Orders: [["Items", "Orders_Items"], ["customer", "Customers"]]
[TRACE] Found 2 expanded navigations in entity
[TRACE] Analyzing expanded navigation: customer with 1 entities
[TRACE] Auto mode: customer has referential constraints -> extracting
[TRACE] Extracting customer -> EntitySet Customers
[TRACE] Enriched parent FK: customer_ID = 22222222-2222-2222-2222-222222222222
[OData Recorder] Captured 2 entities for Orders
[OData Recorder] Captured 1 expanded entities for Customers
```

---

## 🚀 Migration Guide

### For Existing Users

**No action required!** The fixes are backward compatible:

1. **Auto mode** (default): Behavior unchanged for existing recordings
2. **Foreign key enrichment**: Automatically enabled, improves V2 support
3. **Metadata writing**: Happens automatically during startup

### For New Users

1. Ensure your metadata has proper referential constraints defined
2. Use default configuration (`expandedNavigationStrategy: 'auto'`)
3. Test recording mode first, then verify mock mode works
4. Check console for warnings about missing constraints

---

## 📚 Documentation Updates

### New Documentation Files
1. `BUGFIX_SINGLE_ENTITY_NAVIGATION.md` - Details on V4 single-entity fix
2. `BUGFIX_V2_FOREIGN_KEY_ENRICHMENT.md` - Details on V2 FK enrichment
3. `test/appfev4/EXPANDED_NAVIGATION_DEMO.md` - V4 demo guide
4. `test/appfev2/EXPANDED_NAVIGATION_DEMO.md` - V2 demo guide

### Updated Files
- `README.md` - Updated with expanded navigation support
- Demo controllers in both V2 and V4 apps

---

## 🎯 Future Enhancements

### Potential Improvements
1. Support for nested expanded navigations (e.g., `$expand=Items($expand=product)`)
2. Configurable FK enrichment direction (parent-only, child-only, both)
3. Automatic constraint detection from data patterns
4. Support for complex type extraction

### Known Limitations
1. V2 backend must support the navigation property (e.g., `Customers -> Orders`)
2. Containment navigations (`ContainsTarget="true"`) are not extracted (by design)
3. Deferred navigation links are preserved but not followed

---

## 👥 Contributors

- Implementation: AI Assistant (Claude)
- Testing: Marian Zeis
- Review: Marian Zeis

---

## 📞 Support

For issues or questions:
1. Check the demo applications (`test/appfev4`, `test/appfev2`)
2. Enable debug mode to see detailed logs
3. Review the documentation files listed above
4. Check console warnings for missing referential constraints

---

**End of Changelog**

