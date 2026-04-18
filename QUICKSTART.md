# Quick Start Guide - archifind

Get started with archifind in 30 seconds!

## Installation

### Option 1: Install Globally (Recommended)

```bash
npm install -g archifind
```

Then run it anywhere:

```bash
archifind /path/to/your/project
```

### Option 2: Run Without Installing

```bash
npx archifind /path/to/your/project
```

No installation needed—npx downloads and runs it automatically.

### Option 3: Use in Your Project

```bash
npm install archifind --save-dev
npx archifind .
```

## Basic Usage

### Scan the current directory

```bash
archifind .
```

### Scan a specific project

```bash
archifind /Users/you/Documents/my-app
```

### Scan with custom port

```bash
archifind . --port 5000
```

The UI opens automatically at `http://localhost:5000`

### View all options

```bash
archifind --help
```

## What Happens Next?

1. **Scanning**: archifind scans your codebase and builds a graph of file relationships
2. **UI Launch**: Your browser opens with an interactive architecture visualization
3. **File Watcher**: Changes to your code are reflected in real-time
4. **Press `Ctrl+C`** to stop and close the UI

## Configuration

### Skip Auto-Opening Browser

```bash
archifind . --no-open
```

### Don't Rebuild UI

```bash
archifind . --no-build-ui
```

### Force UI Rebuild

```bash
archifind . --rebuild-ui
```

## AI Features (Optional)

Add AI-assisted code understanding using Hugging Face:

```bash
export HF_TOKEN="your-token-here"
archifind . --hf-model "microsoft/Phi-3-mini-4k-instruct"
```

Get a free token: https://huggingface.co/settings/tokens

## Troubleshooting

### "Command not found"

If global install didn't work:

```bash
# Reinstall globally
npm install -g archifind

# Or use with npx
npx archifind .
```

### Port Already in Use

```bash
# Use a different port
archifind . --port 8080
```

### Browser Doesn't Open

```bash
# Disable auto-open and open manually
archifind . --no-open
# Then visit http://localhost:5000
```

## Next Steps

- Read the [full README](../README.md) for advanced usage
- Check [contributing guide](../CONTRIBUTING.md) to help improve archifind
- Report issues: https://github.com/Mensa-Philosophical-Circle/archifind/issues

## Need Help?

- **Issues**: https://github.com/Mensa-Philosophical-Circle/archifind/issues
- **Discussions**: https://github.com/Mensa-Philosophical-Circle/archifind/discussions
