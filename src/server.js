import chokidar from 'chokidar';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProject } from './analyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(targetDir, port) {
  const app = express();
  app.use(express.json());
  app.use(cors());

  const absoluteTargetDir = path.resolve(targetDir);
  const uiPath = path.join(__dirname, '../ui/dist');
  const graphCacheByMode = new Map();
  const DEFAULT_MODE = 'architecture';

  const normalizeGraphMode = (mode) => {
    const normalized = String(mode || DEFAULT_MODE).toLowerCase();
    return normalized === 'file' ? 'file' : 'architecture';
  };

  const refreshGraph = async (mode = DEFAULT_MODE) => {
    const normalizedMode = normalizeGraphMode(mode);
    const graph = await analyzeProject(absoluteTargetDir, { graphMode: normalizedMode });
    graphCacheByMode.set(normalizedMode, graph);
    return graph;
  };

  const refreshAllKnownModes = async () => {
    const modes = graphCacheByMode.size > 0 ? Array.from(graphCacheByMode.keys()) : [DEFAULT_MODE];
    await Promise.all(modes.map(mode => refreshGraph(mode)));
  };

  await refreshGraph(DEFAULT_MODE);

  const ignoredPath = (watchedPath) => {
    const normalized = watchedPath.replace(/\\/g, '/');
    return normalized.includes('/node_modules/')
      || normalized.includes('/dist/')
      || normalized.includes('/vendor/')
      || normalized.includes('/.git/');
  };

  const watcher = chokidar.watch(absoluteTargetDir, {
    ignored: ignoredPath,
    ignoreInitial: true,
  });

  watcher.on('add', () => {
    void refreshAllKnownModes().catch(error => console.warn('[archifind] refresh failed:', error?.message ?? error));
  });
  watcher.on('change', () => {
    void refreshAllKnownModes().catch(error => console.warn('[archifind] refresh failed:', error?.message ?? error));
  });
  watcher.on('unlink', () => {
    void refreshAllKnownModes().catch(error => console.warn('[archifind] refresh failed:', error?.message ?? error));
  });
  watcher.on('error', (error) => {
    if (error && error.code === 'ENOSPC') {
      console.warn('[archifind] File watcher disabled: system watcher limit reached (ENOSPC). API data remains available; use POST /api/graph/refresh to update manually.');
      return;
    }

    console.warn('[archifind] Watcher error:', error?.message ?? error);
  });

  app.get('/api/graph', async (req, res) => {
    try {
      const mode = normalizeGraphMode(req.query.mode);
      if (!graphCacheByMode.has(mode)) {
        await refreshGraph(mode);
      }

      res.json(graphCacheByMode.get(mode));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use(express.static(uiPath));

  app.post('/api/graph/refresh', async (req, res) => {
    try {
      const mode = normalizeGraphMode(req.body?.mode ?? req.query.mode);
      const data = await refreshGraph(mode);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    const indexPath = path.join(uiPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }

    res.status(200).send('API is running. UI needs to be built with "npm run build" in the ui directory.');
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`
archifind is running
Scanning: ${absoluteTargetDir}
UI:       ${url}
      `);

      resolve({ app, server, url, watcher, refreshGraph });
    });
  });
}
