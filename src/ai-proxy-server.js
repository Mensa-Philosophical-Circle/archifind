#!/usr/bin/env node
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getChatModelName, getClassifierModelName, getHuggingFaceToken } from './ai-client.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number.parseInt(process.env.PORT || process.env.ARCHIFIND_AI_PROXY_PORT || '8787', 10);
const WINDOW_MS = Number.parseInt(process.env.ARCHIFIND_PROXY_RATE_WINDOW_MS || '60000', 10);
const MAX_REQUESTS_PER_WINDOW = Number.parseInt(
  process.env.ARCHIFIND_PROXY_MAX_REQUESTS_PER_WINDOW || '30',
  10
);
const MAX_DAILY_REQUESTS_PER_TOKEN = Number.parseInt(
  process.env.ARCHIFIND_PROXY_MAX_DAILY_REQUESTS_PER_TOKEN || '2000',
  10
);
const LOG_FILE = String(process.env.ARCHIFIND_PROXY_LOG_FILE || '').trim();
const ADMIN_TOKEN = String(process.env.ARCHIFIND_PROXY_ADMIN_TOKEN || '').trim();

const allowedTokens = new Set(
  String(process.env.ARCHIFIND_PROXY_ALLOWED_TOKENS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const rateLimitState = new Map();
const dailyQuotaState = new Map();

const metrics = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  totalErrors: 0,
  deniedAuth: 0,
  deniedRateLimit: 0,
  deniedQuota: 0,
};

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function appendLog(entry) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;
  process.stdout.write(line);

  if (!LOG_FILE) return;

  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (error) {
    process.stderr.write(`[archifind-proxy] failed to write log: ${error.message}\n`);
  }
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function ensureAuthorized(req, res, next) {
  const token = getBearerToken(req);

  if (allowedTokens.size === 0) {
    metrics.deniedAuth += 1;
    appendLog({ event: 'auth_denied', reason: 'no_allowed_tokens_configured' });
    res.status(503).json({ error: 'Proxy is not configured with allowed tokens' });
    return;
  }

  if (!token || !allowedTokens.has(token)) {
    metrics.deniedAuth += 1;
    appendLog({ event: 'auth_denied', reason: 'invalid_token', ip: getClientIp(req) });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.archifindToken = token;
  next();
}

function ensureRateLimit(req, res, next) {
  const token = req.archifindToken;
  const ip = getClientIp(req);
  const key = `${token}:${ip}`;
  const now = Date.now();

  const entry = rateLimitState.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count += 1;
  rateLimitState.set(key, entry);

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    metrics.deniedRateLimit += 1;
    appendLog({ event: 'rate_limited', token, ip, count: entry.count });
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  next();
}

function ensureDailyQuota(req, res, next) {
  const token = req.archifindToken;
  const day = new Date().toISOString().slice(0, 10);
  const key = `${token}:${day}`;
  const count = (dailyQuotaState.get(key) || 0) + 1;
  dailyQuotaState.set(key, count);

  if (count > MAX_DAILY_REQUESTS_PER_TOKEN) {
    metrics.deniedQuota += 1;
    appendLog({ event: 'quota_exceeded', token, count, day });
    res.status(429).json({ error: 'Daily quota exceeded' });
    return;
  }

  next();
}

async function callHfChat(prompt, modelName) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    appendLog({
      event: 'hf_chat_error',
      status: response.status,
      detail: errorText.slice(0, 200),
      modelName,
    });
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content
    ? String(data.choices[0].message.content).trim()
    : null;
}

async function callHfZeroShot(prompt, candidateLabels, modelName) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(modelName)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          candidate_labels: candidateLabels,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    appendLog({
      event: 'hf_zero_shot_error',
      status: response.status,
      detail: errorText.slice(0, 200),
      modelName,
    });
    return null;
  }

  const data = await response.json();
  if (Array.isArray(data) && data[0]?.label) {
    return String(data[0].label).toLowerCase();
  }

  if (Array.isArray(data?.labels) && data.labels[0]) {
    return String(data.labels[0]).toLowerCase();
  }

  return null;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    hasHfToken: Boolean(getHuggingFaceToken()),
    startedAt: metrics.startedAt,
  });
});

app.post('/v1/ai/chat', ensureAuthorized, ensureRateLimit, ensureDailyQuota, async (req, res) => {
  metrics.totalRequests += 1;
  const prompt = String(req.body?.prompt || '').trim();
  const model = String(req.body?.model || getChatModelName());

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    const content = await callHfChat(prompt, model);
    if (!content) {
      metrics.totalErrors += 1;
      res.status(502).json({ error: 'Upstream model failed' });
      return;
    }

    appendLog({ event: 'chat_ok', model, token: req.archifindToken, chars: content.length });
    res.json({ content, model });
  } catch (error) {
    metrics.totalErrors += 1;
    appendLog({ event: 'chat_exception', error: error.message, token: req.archifindToken });
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post(
  '/v1/ai/zero-shot',
  ensureAuthorized,
  ensureRateLimit,
  ensureDailyQuota,
  async (req, res) => {
    metrics.totalRequests += 1;
    const prompt = String(req.body?.prompt || '').trim();
    const candidateLabels = Array.isArray(req.body?.candidateLabels)
      ? req.body.candidateLabels.map((item) => String(item)).filter(Boolean)
      : [];
    const model = String(req.body?.model || getClassifierModelName());

    if (!prompt || candidateLabels.length === 0) {
      res.status(400).json({ error: 'prompt and candidateLabels are required' });
      return;
    }

    try {
      const label = await callHfZeroShot(prompt, candidateLabels, model);
      if (!label) {
        metrics.totalErrors += 1;
        res.status(502).json({ error: 'Upstream model failed' });
        return;
      }

      appendLog({ event: 'zero_shot_ok', model, token: req.archifindToken, label });
      res.json({ label, model });
    } catch (error) {
      metrics.totalErrors += 1;
      appendLog({ event: 'zero_shot_exception', error: error.message, token: req.archifindToken });
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

app.get('/v1/ai/metrics', (req, res) => {
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({
    ...metrics,
    rateLimitedKeys: rateLimitState.size,
    quotaKeys: dailyQuotaState.size,
  });
});

app.listen(PORT, () => {
  appendLog({
    event: 'proxy_started',
    port: PORT,
    hasHfToken: Boolean(getHuggingFaceToken()),
    rateLimitPerWindow: MAX_REQUESTS_PER_WINDOW,
    windowMs: WINDOW_MS,
    dailyQuotaPerToken: MAX_DAILY_REQUESTS_PER_TOKEN,
  });
});
