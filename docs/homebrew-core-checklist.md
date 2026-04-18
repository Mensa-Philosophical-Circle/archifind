# Homebrew Core Checklist

This repository includes a tap formula and bottle workflow. To get `archifind` into `homebrew/core`, use this checklist.

## Requirements

1. Publish tagged releases (for example `v1.0.1`) in GitHub Releases.
2. Update `Formula/archifind.rb` to point to the release tarball URL and matching `sha256`.
3. Ensure `brew audit --strict --online --new-formula Formula/archifind.rb` passes.
4. Ensure `brew test Formula/archifind.rb` passes.
5. Confirm there are no policy blockers from Homebrew maintainers.

## Suggested Commands

```bash
brew style Formula/archifind.rb
brew audit --strict --online --new-formula Formula/archifind.rb
brew install --build-from-source ./Formula/archifind.rb
brew test archifind
```

## Submission Flow

1. Fork `Homebrew/homebrew-core`.
2. Add a new formula file for `archifind` in your fork.
3. Open a PR to `Homebrew/homebrew-core`.
4. Address maintainer review comments until merged.

## Notes

- `homebrew/core` inclusion is a maintainer decision and cannot be forced from this repository.
- Keep the tap workflow active even after submission so users can install from your tap while waiting for review.
