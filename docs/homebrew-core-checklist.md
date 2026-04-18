# Homebrew Core Checklist

This repository includes a tap formula and bottle workflow. To get `archifind` into `homebrew/core`, use this checklist.

## Requirements

1. Publish tagged releases (for example `v1.0.1`) in GitHub Releases.
2. Update `Formula/archifind.rb` to point to the release tarball URL and matching `sha256`.
3. Ensure `brew audit --new archifind` passes in a Homebrew core checkout.
4. Ensure `brew test archifind` passes.
5. Confirm there are no policy blockers from Homebrew maintainers.

## Suggested Commands

```bash
# In this repository (tap formula validation)
brew style Formula/archifind.rb
brew audit --strict --online mensa-philosophical-circle/archifind/archifind

# In your homebrew-core fork checkout (new formula validation)
brew audit --new archifind
brew install --build-from-source archifind
brew test archifind
```

## Submission Flow

1. Fork `Homebrew/homebrew-core`.
2. Add a new formula file for `archifind` in your fork.
3. Open a PR to `Homebrew/homebrew-core`.
4. Address maintainer review comments until merged.

## Release Tarball Preparation

Use these commands after creating a Git tag (for example `v1.0.1`) and publishing it:

```bash
TAG=v1.0.1
curl -L --fail -o /tmp/archifind-${TAG}.tar.gz \
	https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/${TAG}.tar.gz
shasum -a 256 /tmp/archifind-${TAG}.tar.gz
```

Then set these in your formula:

- `url "https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/vX.Y.Z.tar.gz"`
- `sha256 "<computed sha256>"`
- `version "X.Y.Z"`

## Notes

- `homebrew/core` inclusion is a maintainer decision and cannot be forced from this repository.
- Keep the tap workflow active even after submission so users can install from your tap while waiting for review.
