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
  let graphCache = { nodes: [], edges: [], generatedAt: null };

  const refreshGraph = async () => {
    graphCache = await analyzeProject(absoluteTargetDir);
    return graphCache;
  };

  await refreshGraph();

  const watcher = chokidar.watch(absoluteTargetDir, {
    ignored: ['**/node_modules/**', '**/dist/**', '**/vendor/**', '**/.git/**'],
    ignoreInitial: true,
  });

  watcher.on('add', refreshGraph);
  watcher.on('change', refreshGraph);
  watcher.on('unlink', refreshGraph);

  app.get('/api/graph', async (req, res) => {
    try {
      res.json(graphCache);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use(express.static(uiPath));

  app.post('/api/graph/refresh', async (req, res) => {
    try {
      const data = await refreshGraph();
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
archfind is running
Scanning: ${absoluteTargetDir}
UI:       ${url}
      `);

      resolve({ app, server, url, watcher, refreshGraph });
    });
  });
}
