# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for the npm packages.

## Workflow

### 1. During Development

When you make changes that should be included in the next release:

```bash
bun changeset
```

This will:

- Prompt you to select which packages are affected (usually select all gubbi packages since they're linked)
- Ask for the type of change (major, minor, or patch)
- Prompt you to describe the change (this goes in the CHANGELOG)

The changeset will be saved as a markdown file in `.changeset/`. Commit this file with your PR.

### 2. Before Release

When ready to release, run:

```bash
bun changeset version
```

This will:

- Consume all changesets in `.changeset/`
- Update all package versions (respecting the linked packages configuration)
- Update CHANGELOGs
- Update the version references in optionalDependencies

Review the changes, then commit them:

```bash
git add .
git commit -m "chore: version packages"
```

### 3. Publish

Create and push a git tag to trigger the publish workflow:

```bash
# Tag with the new version (must match package.json version)
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow will:

- Build all platform binaries
- Create a GitHub Release
- Publish all packages to npm

## Package Linking

All gubbi packages are **linked**, meaning they always get the same version number:

- `gubbi`
- `gubbi-darwin-arm64`
- `gubbi-darwin-x64`
- `gubbi-linux-arm64`
- `gubbi-linux-x64`

When you create a changeset, you can select just one package, but all linked packages will be versioned together.

## Tips

- **Batch changes**: You can create multiple changesets before running `changeset version`
- **Skip changesets**: Not every commit needs a changeset — only user-facing changes
- **Version types**:
  - **major**: Breaking changes (0.x.0 → 1.0.0)
  - **minor**: New features (0.0.x → 0.1.0)
  - **patch**: Bug fixes (0.0.0 → 0.0.1)

## Scripts

- `bun changeset` - Create a new changeset
- `bun changeset version` - Consume changesets and update versions
- `bun changeset status` - Check which changesets are pending
