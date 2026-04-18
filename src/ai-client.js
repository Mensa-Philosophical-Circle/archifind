function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

export function getHuggingFaceToken() {
  return (
    process.env.HF_TOKEN ||
    process.env.HUGGING_FACE_HUB_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    null
  );
}

export function getClassifierModelName() {
  return process.env.HF_MODEL || 'MoritzLaurer/deberta-v3-large-zeroshot-v2.0';
}

export function getChatModelName() {
  return process.env.HF_CHAT_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
}

function getProxyConfig() {
  const baseUrl = normalizeBaseUrl(process.env.ARCHIFIND_AI_PROXY_URL);
  const token = String(process.env.ARCHIFIND_AI_PROXY_TOKEN || '').trim();
  return {
    enabled: Boolean(baseUrl),
    baseUrl,
    token,
    timeoutMs: Number.parseInt(process.env.ARCHIFIND_AI_PROXY_TIMEOUT_MS || '30000', 10),
  };
}

async function callProxy(endpointPath, payload) {
  const proxy = getProxyConfig();
  if (!proxy.enabled || typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxy.timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (proxy.token) {
      headers.Authorization = `Bearer ${proxy.token}`;
    }

    const response = await fetch(`${proxy.baseUrl}${endpointPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(
        `[archifind] AI proxy request failed (${response.status}):`,
        errText.slice(0, 200)
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('[archifind] AI proxy request failed:', error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestProxyChat(prompt, model) {
  const result = await callProxy('/v1/ai/chat', { prompt, model });
  return result?.content ? String(result.content).trim() : null;
}

export async function requestProxyZeroShot(prompt, candidateLabels, model) {
  const result = await callProxy('/v1/ai/zero-shot', {
    prompt,
    candidateLabels,
    model,
  });

  if (!result?.label) {
    return null;
  }

  return String(result.label).toLowerCase();
}

export async function requestHuggingFaceChat(prompt, model = null) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const modelName = model || getChatModelName();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

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
        max_tokens: 2000,
        temperature: 0.1,
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

export async function requestHuggingFaceZeroShot(prompt, candidateLabels, modelName) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
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
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    if (Array.isArray(result) && result[0]?.label) {
      return String(result[0].label).toLowerCase();
    }

    if (Array.isArray(result?.labels) && result.labels[0]) {
      return String(result.labels[0]).toLowerCase();
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
