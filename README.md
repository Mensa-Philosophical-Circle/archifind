# archifind
# Implementation Plan - `archifind` (Combined & Comprehensive)

`archifind` is a cross-platform CLI tool designed to map and visualize the internal architecture of codebases. It goes beyond simple folder grouping to show exactly how components, files, and functions interact across multiple languages.

## User Review Required

> [!IMPORTANT]
> **Consolidated Vision**: This plan combines the initial `archmap` technical depth with the finalized `archifind` decisions.
> - **Multi-Language**: Analyzing JS/TS, Python, and Go in the first release.
> - **Visual Depth**: Implementing an interactive canvas (React Flow) that shows system-wide interactions, not just file hierarchies.
> - **Professional Schematic**: Following a clean, architectural blueprint style (inspired by Eraser.io). This means distinct borders, sharp typography, and high-contrast nodes instead of glassmorphism.

---

## Proposed Changes

### 1. Core Project Infrastructure
Finalize the monorepo-style structure and CLI packaging.

#### [MODIFY] [package.json](file:///home/Dev/Documents/Development/archifind/package.json)
- Ensure all dependencies are consolidated: `commander`, `express`, `fast-glob`, `cors`, `open`.
- Define `bin` link for the `archifind` command.

---

### 2. Multi-Language Backend Analyzer
The backend must handle diverse import/export patterns.

#### [MODIFY] [analyzer.js](file:///home/Dev/Documents/Development/archifind/src/analyzer.js)
- **JS/TS Support**: Extracting ES6 `import`, CommonJS `require`, and `export` symbols.
- **Python Support**: Extracting `import` and `from ... import` statements.
- **Go Support**: Parsing package imports.
- **Graph Generation**: Normalizing all file paths and creating a React Flow-compatible JSON:
  ```json
  {
    "nodes": [{ "id": "path/to/file", "data": { "label": "file.js", "ext": "js" } }],
    "edges": [{ "source": "A", "target": "B", "label": "imports" }]
  }
  ```

#### [MODIFY] [server.js](file:///home/Dev/Documents/Development/archifind/src/server.js)
- Serve the generated graph data via `GET /api/graph`.
- Serve static UI assets from `ui/dist`.
- Implement basic file system watcher (optional but nice) to refresh the graph on changes.

---

### 3. Architectural Blueprint UI (`ui/`)
Build the visual experience using React Flow and Dagre with an Eraser.io aesthetic.

#### [NEW] [GraphCanvas.tsx](file:///home/Dev/Documents/Development/archifind/ui/src/components/GraphCanvas.tsx)
- Implementation of the zoomable, draggable canvas.
- **Auto-Layout Engine**: Integration with `dagre` to compute node positions automatically.
- **Custom Nodes**: Professional schematic nodes with distinct borders, bold file icons, and high-readability labels. No blur or glass effects.

#### [NEW] [App.tsx](file:///home/Dev/Documents/Development/archifind/ui/src/App.tsx)
- Main layout with a **Detail Sidebar** that opens when a node is clicked.
- **Search & Filter Bar**: Highlight specific file patterns or hide nodes with low connectivity.
- **Minimap & Controls**: Standard high-quality navigation controls.

---

## Open Questions

> [!QUESTION]
> 1. **Cross-Language Edges**: If a project has multiple languages (e.g., Python backend + TS frontend), should we attempt to link them via API endpoint strings, or keeps them as separate clusters in the first version?
> 2. **Performance**: For massive codebases (>5000 files), should we implement "Lazy Loading" (only showing sub-graphs) or keep it as a single full map? I'll start with a full map until we hit performance caps.

---

## Verification Plan

### Automated Tests
- **Unit Test**: Run `analyzer.js` against a test repo containing JS, Python, and Go files. Verify that all imports are detected and mapped.
- **Build Test**: Ensure `npm run build` in the UI directory generates a valid bundle for the Express server to serve.

### Manual Verification
- Run `node src/cli.js .` on the `archifind` repository itself.
- Verify that the browser opens automatically to `localhost:4000`.
- Interact with the graph: Drag nodes, click for details, and search for specific files.
- Verify that the layout remains clean and readable even as the project grows.

check eraser.io to get everything i am trying to achieve you wold also need ai for this something open source from hugging face also 

you can check out hat they did here https://github.com/eraserlabs/eraser-io