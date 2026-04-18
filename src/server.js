import chokidar from 'chokidar';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProject } from './analyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getHuggingFaceToken() {
  return (
    process.env.HF_TOKEN ||
    process.env.HUGGING_FACE_HUB_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    null
  );
}

function getClassifierModelName() {
  return process.env.HF_MODEL || 'MoritzLaurer/deberta-v3-large-zeroshot-v2.0';
}

function getChatModelName() {
  return process.env.HF_CHAT_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
}

function buildGraphSummary(graph, selectedNodeId) {
  const selectedNode = selectedNodeId
    ? (graph?.nodes?.find((node) => node.id === selectedNodeId) ?? null)
    : null;
  const topGroups = Array.isArray(graph?.architectureGroups)
    ? graph.architectureGroups.slice(0, 10)
    : [];
  const topNodes = Array.isArray(graph?.nodes) ? graph.nodes.slice(0, 18) : [];
  const relatedEdges = selectedNode
    ? (graph?.edges ?? [])
        .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
        .slice(0, 12)
    : [];

  return [
    `Graph mode: ${graph?.graphMode || graph?.mode || 'architecture'}`,
    `Nodes: ${graph?.nodes?.length ?? 0}`,
    `Edges: ${graph?.edges?.length ?? 0}`,
    `Selected node: ${selectedNode ? `${selectedNode.id} | ${selectedNode.data?.label ?? ''} | role=${selectedNode.data?.role ?? 'unknown'}` : 'none'}`,
    `Top groups: ${topGroups.map((group) => `${group.id}(${group.count})`).join(', ') || 'none'}`,
    `Sample nodes: ${topNodes.map((node) => `${node.id} => ${node.data?.label ?? ''}`).join(' | ')}`,
    `Selected node relations: ${relatedEdges.map((edge) => `${edge.source} -> ${edge.target}`).join(' | ') || 'none'}`,
  ].join('\n');
}

function buildFallbackAnswer(question, graph, selectedNodeId) {
  const selectedNode = selectedNodeId
    ? (graph?.nodes?.find((node) => node.id === selectedNodeId) ?? null)
    : null;
  const topGroups = Array.isArray(graph?.architectureGroups)
    ? graph.architectureGroups.slice(0, 3)
    : [];
  const groupSummary =
    topGroups.map((group) => `${group.id} (${group.count})`).join(', ') || 'no groups';

  return [
    `I can help with that, but the AI model is not available right now.`,
    `This graph has ${graph?.nodes?.length ?? 0} nodes and ${graph?.edges?.length ?? 0} edges.`,
    `The most prominent areas are: ${groupSummary}.`,
    selectedNode
      ? `You selected ${selectedNode.data?.label ?? selectedNode.id}, which is classified as ${selectedNode.data?.role ?? 'unknown'}.`
      : null,
    `Question asked: ${question}`,
  ]
    .filter(Boolean)
    .join(' ');
}

async function askHuggingFace(prompt) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const modelName = getChatModelName();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(
        `[archifind] AI chat request failed (${response.status}):`,
        errText.slice(0, 200)
      );
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    return content ? String(content).trim() : null;
  } catch (error) {
    console.warn('[archifind] AI chat request failed:', error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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

  const refreshGraph = async (mode = DEFAULT_MODE, options = {}) => {
    const normalizedMode = normalizeGraphMode(mode);
    const graph = await analyzeProject(absoluteTargetDir, {
      graphMode: normalizedMode,
      aiNative: options.aiNative ?? process.env.archifind_AI_NATIVE === 'true',
      includeEnv: process.env.ARCHIFIND_INCLUDE_ENV === 'true',
    });
    graphCacheByMode.set(normalizedMode, graph);
    return graph;
  };

  const refreshAllKnownModes = async () => {
    const modes = graphCacheByMode.size > 0 ? Array.from(graphCacheByMode.keys()) : [DEFAULT_MODE];
    await Promise.all(modes.map((mode) => refreshGraph(mode)));
  };

  await refreshGraph(DEFAULT_MODE);

  const includeEnv = process.env.ARCHIFIND_INCLUDE_ENV === 'true';
  const ignoredPath = (watchedPath) => {
    const normalized = watchedPath.replace(/\\/g, '/');
    const baseIgnored =
      normalized.includes('/node_modules/') ||
      normalized.includes('/dist/') ||
      normalized.includes('/vendor/') ||
      normalized.includes('/.git/');

    if (baseIgnored) return true;

    if (!includeEnv) {
      const filename = path.basename(normalized);
      if (filename === '.env' || filename.startsWith('.env.')) {
        return true;
      }
    }

    return false;
  };

  const watcher = chokidar.watch(absoluteTargetDir, {
    ignored: ignoredPath,
    ignoreInitial: true,
  });

  watcher.on('add', () => {
    void refreshAllKnownModes().catch((error) =>
      console.warn('[archifind] refresh failed:', error?.message ?? error)
    );
  });
  watcher.on('change', () => {
    void refreshAllKnownModes().catch((error) =>
      console.warn('[archifind] refresh failed:', error?.message ?? error)
    );
  });
  watcher.on('unlink', () => {
    void refreshAllKnownModes().catch((error) =>
      console.warn('[archifind] refresh failed:', error?.message ?? error)
    );
  });
  watcher.on('error', (error) => {
    if (error && error.code === 'ENOSPC') {
      console.warn(
        '[archifind] File watcher disabled: system watcher limit reached (ENOSPC). API data remains available; use POST /api/graph/refresh to update manually.'
      );
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
      const aiNative = req.body?.aiNative === true || req.query.aiNative === 'true';
      const data = await refreshGraph(mode, { aiNative });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ask', async (req, res) => {
    try {
      const question = String(req.body?.question || '').trim();
      const mode = normalizeGraphMode(req.body?.graphMode);
      const selectedNodeId = String(req.body?.selectedNodeId || '').trim();

      if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      if (!graphCacheByMode.has(mode)) {
        await refreshGraph(mode);
      }

      const graph = graphCacheByMode.get(mode);
      const summary = buildGraphSummary(graph, selectedNodeId);
      const prompt = [
        'You are an architecture assistant for a codebase visualization tool.',
        'Answer from the perspective of helping a human understand the structure visually.',
        'Do not describe implementation details unless they help the user understand the map.',
        'Prefer recommendations like cluster, group, simplify, highlight, or hide.',
        'Use the graph context below.',
        '',
        summary,
        '',
        `Question: ${question}`,
        'Answer:',
      ].join('\n');

      const aiAnswer = await askHuggingFace(prompt);
      const answer = aiAnswer || buildFallbackAnswer(question, graph, selectedNodeId);

      res.json({
        answer,
        usedAi: Boolean(aiAnswer),
        model: getChatModelName(),
        classifierModel: getClassifierModelName(),
      });
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

    res
      .status(200)
      .send('API is running. UI needs to be built with "npm run build" in the ui directory.');
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.info(`
archifind is running
Scanning: ${absoluteTargetDir}
UI:       ${url}
      `);

      resolve({ app, server, url, watcher, refreshGraph });
    });
  });
}
