## Title

archifind 1.0.1 (new formula)

## Body

Adds a new formula for `archifind`, a CLI that scans codebases and visualizes architecture as an interactive graph.

Project homepage: https://github.com/Mensa-Philosophical-Circle/archifind

### Source

- URL: https://github.com/Mensa-Philosophical-Circle/archifind/archive/refs/tags/v1.0.1.tar.gz
- SHA256: fc66a3f149b7a4c09d2da13777bafd5cb60c5caa36abfac8a9243ef09db06fba

### Validation (tap)

- [x] `brew style Formula/archifind.rb`
- [x] `brew audit --strict --online mensa-philosophical-circle/archifind/archifind`

### Validation (homebrew/core fork)

- [ ] `brew audit --new archifind`
- [ ] `brew install --build-from-source archifind`
- [ ] `brew test archifind`

### Notes

- Formula depends on `node` and installs a CLI entry point named `archifind`.
- Source points to a stable, tagged release tarball.
