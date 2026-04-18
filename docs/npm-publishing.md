# NPM Publishing Guide for archifind

This guide explains how to publish archifind to npm and manage releases.

## Prerequisites

- NPM account with access to the `archifind` package
- Local npm credentials configured: `npm login`
- Git push access to the repository

## Publishing Flow

### 1. Bump Version

Edit `package.json` version field following semver:

- **Major** (X.0.0): Breaking changes
- **Minor** (1.X.0): New features, backward compatible
- **Patch** (1.0.X): Bug fixes

```bash
# Example: Update to 1.0.1
npm version patch --no-git-tag-version

# Or manually edit package.json and commit
git add package.json
git commit -m "chore: bump version to 1.0.1"
```

### 2. Create Release Tag

```bash
# Create and push a semver tag
git tag v1.0.1
git push origin v1.0.1
```

This will:

- Trigger GitHub Actions workflows
- Build the package
- Update Homebrew formula (if configured)

### 3. Build and Publish to npm

```bash
# Clean install to ensure dependencies are correct
npm ci

# Run full quality checks
npm run quality

# Build UI assets
npm run ui:build

# Publish to npm (dry-run first!)
npm publish --dry-run

# If dry-run looks good, publish for real
npm publish
```

### 4. Verify Publishing

```bash
# Check npm registry
npm view archifind version

# Test global installation in a new terminal
npm install -g archifind
archifind --help
```

### 5. Create GitHub Release

- Go to: https://github.com/Mensa-Philosophical-Circle/archifind/releases
- Click "Draft a new release"
- Select the tag you just created (v1.0.1)
- Add release notes describing changes
- Publish release

## What Gets Published to npm

The `package.json` `files` field controls what's included. Currently publishes:

```
src/          # Source code
ui/dist/      # Pre-built UI assets
package.json  # Package metadata
README.md     # Documentation
LICENSE       # License file
```

## npm Package Structure

**Package name**: `archifind`
**Bin entry**: Points to `src/cli.js`

Users can install with:

```bash
npm install -g archifind      # Global command
npx archifind .               # Run without installing
npm install archifind --save  # Local project dependency
```

## Automated Publishing

After creating a Git tag (v\*), GitHub Actions will:

1. Run quality checks (ESLint, formatting, types)
2. Run security scans
3. Build UI assets
4. **Note**: Direct npm publishing from CI requires setup (see section below)

## Manual vs Automated Publishing

**Current**: Manual publishing (you run `npm publish` locally)
**Why**: Safer to control who publishes and when

**Future**: Could add automatic publishing to CI/CD:

```yaml
# Example GitHub Actions CI/CD step for auto-publish
- name: Publish to npm
  if: startsWith(github.ref, 'refs/tags/v')
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

To enable auto-publishing:

1. Create npm automation token: https://www.npmjs.com/settings/~/tokens
2. Add to GitHub Secrets as `NPM_TOKEN`
3. Add publish step to `.github/workflows/publish.yml`

## Troubleshooting

**"You must be logged in"**

```bash
npm login
# Enter credentials, then publish again
```

**"Package already exists at this version"**
Version is already published. Bump version in package.json and try again.

**"npm ERR! 403 Forbidden"**
You don't have publish rights to this package. Check npm permissions.

**"Files not found"**
Make sure UI is built before publishing:

```bash
npm run ui:build
npm publish
```

## Publishing Checklist

- [ ] All tests passing locally (`npm run quality`)
- [ ] UI built (`npm run ui:build`)
- [ ] Version bumped in package.json
- [ ] Commit pushed to main branch
- [ ] Git tag created (v1.0.X)
- [ ] Tag pushed to origin
- [ ] `npm publish --dry-run` successful
- [ ] `npm publish` successful
- [ ] New version visible on npm: `npm view archifind`
- [ ] Global install works: `npm install -g archifind && archifind --help`
- [ ] GitHub release created with notes
- [ ] Announce release in channels

## Package.json Configuration

Key fields for npm publishing:

```json
{
  "name": "archifind",
  "version": "1.0.0",
  "description": "A CLI for scanning codebases and visualizing their architecture",
  "main": "src/cli.js",
  "bin": {
    "archifind": "./src/cli.js"
  },
  "files": ["src/", "ui/dist/", "LICENSE"],
  "engines": {
    "node": ">=18"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/Mensa-Philosophical-Circle/archifind.git"
  },
  "keywords": ["cli", "architecture", "codebase", "visualization"],
  "author": "Mensa Philosophical Circle",
  "license": "ISC"
}
```

## Quick Reference

```bash
# Prepare a release
npm run quality:fix            # Auto-fix any issues
npm run ui:build               # Build UI assets
git add .
git commit -m "chore: prepare v1.0.1 release"
git tag v1.0.1
git push origin main v1.0.1

# Publish
npm publish

# Verify
npm view archifind version     # Check npm registry
npm install -g archifind       # Test global install
archifind --help              # Verify it works
```
