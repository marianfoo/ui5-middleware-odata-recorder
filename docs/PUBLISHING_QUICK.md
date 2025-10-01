# Quick Release Reference Card

**Quick copy-paste commands for releasing new versions**

---

## 🚀 Standard Release (Patch)

For bug fixes and small updates (0.0.1 → 0.0.2):

```bash
# 1. Ensure clean state
git checkout main && git pull

# 2. Bump version and create tag
npm run release:bump:patch

# 3. Push to trigger CI publish
npm run release:tag:push
```

✅ **Done!** GitHub Actions will automatically publish to npm.

---

## 🎯 Feature Release (Minor)

For new features (0.0.1 → 0.1.0):

```bash
git checkout main && git pull
npm run release:bump:minor
npm run release:tag:push
```

---

## 💥 Breaking Changes (Major)

For breaking changes (0.0.1 → 1.0.0):

```bash
git checkout main && git pull
npm run release:bump:major
npm run release:tag:push
```

---

## 🔍 Pre-Release Checks

Before bumping version:

```bash
# Build and test
npm run build:clean && npm test

# Preview package contents
npm run release:check

# Check what will be published
npm pack --dry-run | grep "notice"
```

---

## 🛠️ Manual Publish (Emergency)

If CI fails and you need to publish manually:

```bash
# Ensure built and tested
npm run build:clean
npm test

# Login and publish
npm login
npm publish
```

---

## 📝 What Each Command Does

| Command | Action |
|---------|--------|
| `npm run release:bump:patch` | Version 0.0.1 → 0.0.2 |
| `npm run release:bump:minor` | Version 0.0.1 → 0.1.0 |
| `npm run release:bump:major` | Version 0.0.1 → 1.0.0 |
| `npm run release:tag:push` | Push commits + tags |
| `npm run release:check` | Preview package |

---

## 🔗 Links

- **Full Guide**: [PUBLISHING.md](../PUBLISHING.md)
- **npm Package**: https://www.npmjs.com/package/ui5-middleware-odata-recorder
- **GitHub**: https://github.com/marianfoo/ui5-odata-recorder

---

## ⚡ Troubleshooting

**"Version already exists"**
```bash
# Version was already published, bump to next version
npm run release:bump:patch
```

**"GitHub Action failed"**
1. Check: https://github.com/marianfoo/ui5-odata-recorder/actions
2. Verify `NPM_TOKEN` secret is set
3. Re-run failed workflow or publish manually

**"Tests failing"**
```bash
# Run tests locally first
npm test

# Fix issues, then:
git add .
git commit -m "fix: description"
# Then retry release
```

