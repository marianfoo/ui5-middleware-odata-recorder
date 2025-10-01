# Publishing Guide

This document explains how to publish `ui5-middleware-odata-recorder` to npm.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Package Configuration](#package-configuration)
3. [Manual Publishing (First Release)](#manual-publishing-first-release)
4. [Automated Publishing (GitHub Actions)](#automated-publishing-github-actions)
5. [Release Process (Future Versions)](#release-process-future-versions)
6. [Pre-publish Checklist](#pre-publish-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. npm Account Setup

```bash
# Create npm account (if you don't have one)
# Visit: https://www.npmjs.com/signup

# Login to npm from terminal
npm login

# Verify login
npm whoami
```

### 2. GitHub Repository Secrets

For automated publishing via GitHub Actions:

1. **Create npm Automation Token**:
   - Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → Select "Automation"
   - Copy the token (you won't see it again!)

2. **Add to GitHub Secrets**:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

---

## Package Configuration

The package is already configured for publishing with:

### `package.json` Key Fields

```json
{
  "name": "ui5-middleware-odata-recorder",
  "version": "0.0.1",
  "main": "lib/middleware/odataRecorder.js",
  "types": "dist/types.d.ts",
  "files": [
    "lib/",
    "dist/",
    "ui5.yaml",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "peerDependencies": {
    "@ui5/cli": "^3.0.0"
  }
}
```

### What Gets Published

Only these files/folders are included in the npm package:
- `lib/` - Compiled JavaScript entry point
- `dist/` - Full TypeScript compilation output (types, maps, etc.)
- `ui5.yaml` - UI5 tooling extension definition
- `README.md` - Documentation
- `LICENSE` - Apache-2.0 license

**Excluded** (via `.npmignore`):
- `test/` - Test applications and fixtures
- `docs/` - Extended documentation
- `src/` - TypeScript source (users get compiled JS)
- Development config files (tsconfig, jest, etc.)

---

## Manual Publishing (First Release)

### Step 1: Pre-flight Checks

```bash
# Ensure you're on main/master branch
git checkout main
git pull origin main

# Clean install dependencies
npm ci

# Build the package
npm run build

# Run all tests
npm test

# Check test coverage (optional)
npm run test:coverage
```

### Step 2: Verify Package Contents

```bash
# Dry-run to see what will be published
npm pack --dry-run

# Or use the helper script
npm run release:check
```

Expected output should show:
```
npm notice 📦  ui5-middleware-odata-recorder@0.0.1
npm notice === Tarball Contents ===
npm notice 1.2kB  LICENSE
npm notice 5.1kB  README.md
npm notice 159B   ui5.yaml
npm notice ...    lib/middleware/odataRecorder.js
npm notice ...    dist/types.d.ts
npm notice ...    dist/middleware/odataRecorder.js
```

### Step 3: Publish to npm

```bash
# Login if not already
npm login

# Publish the package
npm publish

# For scoped packages (e.g., @marian/ui5-middleware-odata-recorder)
# Use: npm publish --access public
```

✅ **Success!** Your package is now live at: https://www.npmjs.com/package/ui5-middleware-odata-recorder

### Step 4: Tag the Release in Git

```bash
# Create a git tag for the release
git tag -a v0.0.1 -m "Release v0.0.1: Initial release"

# Push the tag to GitHub
git push origin v0.0.1
```

---

## Automated Publishing (GitHub Actions)

After the first manual publish, use GitHub Actions for future releases.

### How It Works

The workflow in `.github/workflows/publish-on-tag.yml`:

1. **Triggers** when you push a tag matching `v*` (e.g., `v0.0.2`)
2. **Runs** CI checks:
   - Installs dependencies
   - Builds the package
   - Runs tests
3. **Publishes** to npm automatically
4. **Creates** a GitHub Release with auto-generated notes

### Workflow File

The workflow is already configured at `.github/workflows/publish-on-tag.yml`.

Key steps:
- Checks out code
- Sets up Node.js 20
- Authenticates with npm using `NPM_TOKEN` secret
- Builds and tests
- Publishes to npm
- Creates GitHub release

---

## Release Process (Future Versions)

### Quick Release (Patch Version)

Use this for bug fixes and small updates:

```bash
# 1. Ensure you're up to date
git checkout main
git pull origin main

# 2. Bump version (0.0.1 → 0.0.2)
npm run release:bump:patch

# This does:
# - Updates package.json version
# - Updates package-lock.json
# - Creates a git commit: "chore(release): v0.0.2"
# - Creates a git tag: v0.0.2

# 3. Push changes and tag
npm run release:tag:push

# Or manually:
# git push && git push --tags
```

### Minor Version (New Features)

Use for new features:

```bash
npm run release:bump:minor  # 0.0.1 → 0.1.0
npm run release:tag:push
```

### Major Version (Breaking Changes)

Use for breaking changes:

```bash
npm run release:bump:major  # 0.0.1 → 1.0.0
npm run release:tag:push
```

### What Happens Next

1. **GitHub Actions automatically triggers** when the tag is pushed
2. **CI runs** build and tests
3. **Package publishes** to npm
4. **GitHub Release created** with changelog

---

## Pre-publish Checklist

Before every release, verify:

### ✅ Code Quality
- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No linting errors
- [ ] TypeScript compiles without errors

### ✅ Documentation
- [ ] README.md is up to date
- [ ] CHANGELOG updated (if using conventional changelog)
- [ ] Breaking changes documented

### ✅ Package Configuration
- [ ] Version number is correct in `package.json`
- [ ] Dependencies are correct (no missing/extra deps)
- [ ] `peerDependencies` are accurate
- [ ] License file exists

### ✅ Build Output
- [ ] `npm pack --dry-run` shows correct files
- [ ] No test files in package
- [ ] No sensitive data in package
- [ ] TypeScript definitions (`.d.ts`) are generated

### ✅ Git
- [ ] All changes committed
- [ ] Working directory clean
- [ ] On correct branch (main/master)

---

## Troubleshooting

### Issue: "You do not have permission to publish"

**Solution:**
```bash
# Ensure you're logged in
npm whoami

# Re-login if needed
npm logout
npm login
```

### Issue: "Version already exists"

**Solution:**
```bash
# The version in package.json already exists on npm
# Bump to next version:
npm version patch  # or minor/major
```

### Issue: GitHub Action fails with "Invalid npm token"

**Solution:**
1. Generate new npm automation token
2. Update `NPM_TOKEN` secret in GitHub
3. Re-run the workflow

### Issue: Package includes test files

**Solution:**
```bash
# Check what will be published:
npm pack --dry-run

# Verify .npmignore is correct
cat .npmignore

# Ensure package.json "files" field is correct
```

### Issue: prepublishOnly script fails

**Solution:**
```bash
# Run each step manually to find the issue:
npm run clean:build
npm run build
npm test

# Check for TypeScript errors:
npx tsc --noEmit
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.0.1   | TBD  | Initial release |

---

## Useful Commands Reference

```bash
# Development
npm run build              # Compile TypeScript
npm run watch             # Watch mode for development
npm test                  # Run tests
npm run test:coverage     # Tests with coverage

# Release Preparation
npm run release:check     # Preview package contents
npm run clean:build       # Clean and rebuild

# Version Bumping
npm run release:bump:patch   # Bump patch version
npm run release:bump:minor   # Bump minor version
npm run release:bump:major   # Bump major version
npm run release:tag:push     # Push commits and tags

# Manual Publishing
npm login                 # Login to npm
npm publish              # Publish package
npm pack --dry-run       # Test package contents
```

---

## Advanced: Using Conventional Changelog

For automated changelog generation:

```bash
# Install (one-time)
npm install -D conventional-changelog-cli

# Add to package.json scripts:
"changelog": "conventional-changelog -p angular -i CHANGELOG.md -s -r 0"

# Generate changelog before release:
npm run changelog
git add CHANGELOG.md
git commit -m "docs: update changelog"
```

Then follow normal release process.

---

## Support

- **Issues**: https://github.com/marianfoo/ui5-odata-recorder/issues
- **npm**: https://www.npmjs.com/package/ui5-middleware-odata-recorder

---

## License

Apache-2.0 © Marian Zeis

