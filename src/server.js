import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProject } from './analyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startServer(targetDir, port) {
  const app = express();
  app.use(cors());
  
  const absoluteTargetDir = path.resolve(targetDir);

  app.get('/api/graph', async (req, res) => {
    try {
      const data = await analyzeProject(absoluteTargetDir);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve static UI if in production/dist mode
  const uiPath = path.join(__dirname, '../ui/dist');
  app.use(express.static(uiPath));

  // Middleware for SPA routing
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(uiPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('API is running. UI needs to be built with "npm run build" in the ui directory.');
      }
    });
  });

  app.listen(port, () => {
    console.log(`
🚀 archfind is running!
📂 Scanning: ${absoluteTargetDir}
🌐 UI:       http://localhost:${port}
    `);
  });
}
