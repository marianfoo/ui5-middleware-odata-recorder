# Changelog

All notable changes to this project will be documented in this file.

## [0.0.12] - 2025-11-12

### Fixed
- **CRITICAL**: Fixed package.json `main` entry point from `lib/` to `dist/` to match TypeScript build output
- Enhanced OData V2 association mapping logic to handle multiple name formats
- Added extensive debug logging for association and association set lookup
- Fixed navigation property to EntitySet mapping for V2 metadata

### Changed
- Improved association matching to try multiple name format variations (with/without namespace)
- Added console logging for association lookup diagnostics

### Impact
This is a critical fix for OData V2 expanded navigation support. Previous versions (0.0.11 and earlier) had an incorrect entry point that prevented the middleware from loading correctly when installed via npm.

## [0.0.11] - 2025-11-11

### Added
- Expanded navigation support for OData V2 and V4
- Referential constraint detection and validation
- Foreign key enrichment (bidirectional)
- Hybrid navigation strategy (auto/always-separate/always-inline)

### Fixed
- Single-entity navigation detection in V4 (using @odata.id)
- V2 foreign key enrichment for parent entities
- Metadata writing during proactive load

## [0.0.10] - 2025-11-10

### Added
- Initial expanded navigation recording support
- Basic V2 and V4 metadata parsing

## Earlier Versions

See git history for changes in versions 0.0.9 and earlier.

