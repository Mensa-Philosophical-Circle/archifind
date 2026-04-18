# Homebrew Core PR Template

Use this draft when opening your PR to Homebrew core.

## Title

archifind 1.0.0 (new formula)

## Body

Adds a new formula for `archifind`, a CLI that scans codebases and visualizes architecture as an interactive graph.

Project homepage: https://github.com/Mensa-Philosophical-Circle/archifind

### Validation

- [x] `brew audit --new archifind`
- [x] `brew style --fix Formula/a/archifind.rb` (if needed)
- [x] `brew install --build-from-source archifind`
- [x] `brew test archifind`

### Notes

- Source tarball URL points to a stable tagged release.
- SHA256 is computed from the release tarball.
- Formula depends on `node` and installs a CLI entry point named `archifind`.
