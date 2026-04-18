# Archifind

`archifind` is a CLI that scans a codebase, infers how the project is structured, and serves that information as an interactive architecture map in the browser.

It is built for people who want a fast way to understand a repo without reading every file first. The current version focuses on:

- scanning local projects from the command line
- building a graph of files and their imports/relationships
- classifying files into architecture roles such as `api`, `service`, `frontend`, `shared`, `database`, `config`, `tests`, and `docs`
- serving an interactive UI from a local Express server
- refreshing the graph when files change
- optionally using Hugging Face models for AI-assisted classification and chat

## Quick Start

Get started in 30 seconds:

```bash
npm install -g archifind
archifind /path/to/your/project
```

Or run without installing:

```bash
npx archifind /path/to/your/project
```

See [QUICKSTART.md](QUICKSTART.md) for more examples.

## What It Does

When you run `archifind` against a repository, it:

1. walks the target directory and finds source files
2. parses supported import styles in JavaScript, TypeScript, Python, and Go
3. resolves file-to-file relationships where possible
4. groups files into higher-level architecture roles
5. serves the resulting graph on a local web app
6. keeps the graph up to date while the file watcher is running

The CLI also exposes AI-related options. If you provide a Hugging Face token, `archifind` can use hosted models for:

- architecture role classification
- component classification
- natural-language questions about the graph in the UI

## Install

### Quick Start (Recommended)

**Option 1: Global Installation**

```bash
npm install -g archifind
archifind /path/to/project
```

**Option 2: Run Without Installing**

```bash
npx archifind /path/to/project
```

Both methods work on macOS, Linux, and Windows with Node.js >=18 installed.

### Development Setup

If you want to develop archifind locally:

```bash
git clone https://github.com/Mensa-Philosophical-Circle/archifind.git
cd archifind
npm install
npm run start .          # Run CLI directly
npm link                 # Create global command from source
```

Then use the development version:

```bash
archifind /path/to/project
```

### Requirements

- **Node.js** >=18 ([Install Node.js](https://nodejs.org/))
- **npm** (comes with Node.js)

To check your versions:

```bash
node --version
npm --version
```

### Homebrew Installation (Optional)

If you prefer Homebrew, you can tap the formula repository:

```bash
brew tap Mensa-Philosophical-Circle/archifind
brew install archifind
archifind /path/to/project
```

However, npm methods above are faster and don't require Homebrew.

## Usage

Scan the current directory:

```bash
archifind .
```

Scan another project:

```bash
archifind /path/to/your/project
```

Use a different port:

```bash
archifind . --port 5000
```

Do not open the browser automatically:

```bash
archifind . --no-open
```

Skip rebuilding the UI before startup:

```bash
archifind . --no-build-ui
```

Force a UI rebuild:

```bash
archifind . --rebuild-ui
```

## AI Configuration

`archifind` can use Hugging Face models if you want AI-assisted labels or chat.

Set a token with any of these environment variables:

```bash
export HF_TOKEN="your-token-here"
```

Or pass it directly:

```bash
archifind . --hf-token "your-token-here"
```

Choose a different model if needed:

```bash
archifind . --hf-model "microsoft/Phi-3-mini-4k-instruct"
```

Disable AI features when you want a fully local run:

```bash
archifind . --no-ai-assist --no-ai-components --no-ai-native
```

## Make It a Shell Command

If you used `npm link`, you usually do not need any extra setup.

If you want a permanent command in `zsh`, add a small wrapper in your `~/.zshrc`:

```bash
export ARCHIFIND_HOME="$HOME/dev/archifind"
alias archifind="node $ARCHIFIND_HOME/src/cli.js"
```

Then reload your shell:

```bash
source ~/.zshrc
```

If you prefer a function that forwards all arguments cleanly:

```bash
archifind() {
  node "$HOME/dev/archifind/src/cli.js" "$@"
}
```

You can also make the CLI executable and call it directly from the checkout:

```bash
chmod +x src/cli.js
./src/cli.js .
```

If you want to make it available in every terminal on macOS or Linux without typing the full path, `npm link` is the quickest path.

## UI

`archifind` starts a local web server and serves the UI from the bundled `ui/dist` build.

The interface is meant to help you:

- pan around the code graph
- inspect a file or module in a detail panel
- understand which parts of the repo are connected
- spot isolated areas, shared modules, and likely boundaries

## Supported Languages

The analyzer currently understands:

- JavaScript and TypeScript, including ES modules, CommonJS `require`, and re-exports
- Python `import` and `from ... import` statements
- Go import blocks and single-line imports

## Development

From the repository root:

```bash
npm install
cd ui && npm install
```

Build the UI:

```bash
cd ui
npm run build
```

Start the CLI:

```bash
node src/cli.js .
```

## Notes

- The UI is served locally; nothing is uploaded unless you enable Hugging Face features.
- If the browser does not open automatically, use the printed localhost URL.
- For large repos, the first scan can take a moment while the graph is built.

## Roadmap

The project is still evolving toward a more schematic, Eraser-style architecture view with stronger AI-assisted organization and richer visual grouping.

If you want, I can also add a shorter README badge section, an install-from-`npx` path, or a proper `package.json` `scripts` section to match the new docs.
