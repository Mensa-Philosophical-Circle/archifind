import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';

const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const PY_EXTENSIONS = ['.py'];
const GO_EXTENSIONS = ['.go'];

const JS_IMPORT_RE = /^\s*import\s+[^'"\n]+from\s+['"]([^'"]+)['"]/gm;
const JS_SIDE_EFFECT_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]/gm;
const JS_REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const JS_EXPORT_FROM_RE = /^\s*export\s+(?:\*|\{[^\n]*\})\s+from\s+['"]([^'"]+)['"]/gm;
const JS_EXPORT_SYMBOL_RE = /^\s*export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const JS_NAMED_EXPORT_RE = /^\s*export\s*\{([^\n]+)\}/gm;

const PY_IMPORT_RE = /^\s*import\s+([\w.]+(?:\s+as\s+[\w.]+)?(?:\s*,\s*[\w.]+(?:\s+as\s+[\w.]+)?)*)/gm;
const PY_FROM_IMPORT_RE = /^\s*from\s+([\w.]+)\s+import\s+([\w.*(),\s]+)/gm;
const PY_DEF_RE = /^\s*(?:def|class)\s+([A-Za-z_][\w]*)/gm;

const GO_IMPORT_RE = /^\s*import\s+"([^"]+)"/gm;
const GO_IMPORT_BLOCK_RE = /import\s*\(([^)]+)\)/gm;

const ARCHITECTURE_LABELS = [
  'database',
  'orm',
  'api',
  'service',
  'frontend',
  'shared',
  'config',
  'infra',
  'tests',
  'docs',
  'script',
  'unknown',
];

const HF_ZERO_SHOT_LABELS = [
  'database',
  'orm',
  'api',
  'service',
  'frontend',
  'shared',
  'config',
  'infra',
  'tests',
  'docs',
  'script',
];

const HIDDEN_ROLES = new Set(['config', 'infra', 'tests', 'docs', 'script']);

function clampText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function normalizeRelativePath(rootPath, absolutePath) {
  return toPosixPath(path.relative(rootPath, absolutePath));
}

function createCandidatePaths(rootPath, filePath, dependency, language) {
  const candidates = new Set();
  const fileDir = path.dirname(filePath);
  const normalizedDependency = dependency.replace(/\\/g, '/');

  const addCandidatesFromBase = (basePath) => {
    candidates.add(basePath);

    for (const extension of JS_EXTENSIONS) {
      candidates.add(`${basePath}${extension}`);
      candidates.add(path.join(basePath, `index${extension}`));
    }

    for (const extension of PY_EXTENSIONS) {
      candidates.add(`${basePath}${extension}`);
      candidates.add(path.join(basePath, `__init__${extension}`));
    }

    for (const extension of GO_EXTENSIONS) {
      candidates.add(`${basePath}${extension}`);
    }
  };

  if (normalizedDependency.startsWith('.')) {
    addCandidatesFromBase(path.resolve(fileDir, normalizedDependency));
  } else if (language === 'python' && normalizedDependency.startsWith('..')) {
    addCandidatesFromBase(path.resolve(fileDir, normalizedDependency));
  } else {
    const stripped = normalizedDependency
      .replace(/^@[^/]+\//, '')
      .replace(/^\/+/, '');

    addCandidatesFromBase(path.resolve(rootPath, stripped));
    addCandidatesFromBase(path.resolve(rootPath, stripped.replace(/\./g, '/')));
  }

  return Array.from(candidates).map(candidate => normalizeRelativePath(rootPath, candidate));
}

function resolveDependency(rootPath, filePath, dependency, language, lookup) {
  const candidates = createCandidatePaths(rootPath, filePath, dependency, language);

  for (const candidate of candidates) {
    if (lookup.has(candidate)) {
      return candidate;
    }
  }

  const dependencyStem = dependency
    .replace(/^@[^/]+\//, '')
    .replace(/^\.\/?/, '')
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs|py|go)$/, '')
    .split('/')
    .filter(Boolean)
    .pop();

  if (!dependencyStem) {
    return null;
  }

  return Array.from(lookup.keys()).find((candidate) => {
    const candidateStem = path.basename(candidate, path.extname(candidate));
    return candidateStem === dependencyStem || candidate.endsWith(`/${dependencyStem}.py`) || candidate.endsWith(`/${dependencyStem}.go`) || candidate.endsWith(`/${dependencyStem}/index.js`) || candidate.endsWith(`/${dependencyStem}/index.ts`);
  }) ?? null;
}

function parseJavaScriptImports(content) {
  const dependencies = new Set();
  const exportedSymbols = new Set();

  for (const regex of [JS_IMPORT_RE, JS_SIDE_EFFECT_IMPORT_RE, JS_REQUIRE_RE, JS_EXPORT_FROM_RE]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }
  }

  JS_EXPORT_SYMBOL_RE.lastIndex = 0;
  let match;
  while ((match = JS_EXPORT_SYMBOL_RE.exec(content)) !== null) {
    exportedSymbols.add(match[1]);
  }

  JS_NAMED_EXPORT_RE.lastIndex = 0;
  while ((match = JS_NAMED_EXPORT_RE.exec(content)) !== null) {
    match[1]
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const exportedName = entry.split(/\s+as\s+/i).pop();
        if (exportedName) {
          exportedSymbols.add(exportedName.trim());
        }
      });
  }

  return {
    dependencies: Array.from(dependencies),
    exports: Array.from(exportedSymbols),
  };
}

function parsePythonImports(content) {
  const dependencies = new Set();
  const exportedSymbols = new Set();

  PY_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = PY_IMPORT_RE.exec(content)) !== null) {
    match[1]
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const moduleName = entry.split(/\s+as\s+/i)[0].trim();
        if (moduleName) {
          dependencies.add(moduleName);
        }
      });
  }

  PY_FROM_IMPORT_RE.lastIndex = 0;
  while ((match = PY_FROM_IMPORT_RE.exec(content)) !== null) {
    if (match[1]) {
      dependencies.add(match[1]);
    }
  }

  PY_DEF_RE.lastIndex = 0;
  while ((match = PY_DEF_RE.exec(content)) !== null) {
    exportedSymbols.add(match[1]);
  }

  return {
    dependencies: Array.from(dependencies),
    exports: Array.from(exportedSymbols),
  };
}

function parseGoImports(content) {
  const dependencies = new Set();

  GO_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = GO_IMPORT_RE.exec(content)) !== null) {
    dependencies.add(match[1]);
  }

  GO_IMPORT_BLOCK_RE.lastIndex = 0;
  while ((match = GO_IMPORT_BLOCK_RE.exec(content)) !== null) {
    const blockContent = match[1];
    const blockMatches = blockContent.match(/"([^"]+)"/g) ?? [];
    blockMatches.forEach((entry) => {
      dependencies.add(entry.replace(/"/g, ''));
    });
  }

  return {
    dependencies: Array.from(dependencies),
    exports: [],
  };
}

function parseFile(content, extension) {
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(extension)) {
    return parseJavaScriptImports(content);
  }

  if (extension === '.py') {
    return parsePythonImports(content);
  }

  if (extension === '.go') {
    return parseGoImports(content);
  }

  return { dependencies: [], exports: [] };
}

function inferArchitectureRoleHeuristically(filePath, content, extension) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  const hasPathToken = (token) => new RegExp(`(^|[/_.-])${token}([/_.-]|$)`).test(lowerPath);
  const hasAnyPathToken = (tokens) => tokens.some(token => hasPathToken(token));

  if (/(^|\/)cli\.(js|ts)$/.test(lowerPath) || /(tools|scripts|bin)\//.test(lowerPath)) {
    return 'script';
  }

  if (/(^|\/)analyzer\.(js|ts)$/.test(lowerPath)) {
    return 'service';
  }

  if (/(^|\/)server\.(js|ts)$/.test(lowerPath)) {
    return 'api';
  }

  if (/(__tests__|\.test\.|\.spec\.|test\b|spec\b)/.test(lowerPath)) {
    return 'tests';
  }

  if (/^(readme|changelog|license)|\.md$/.test(lowerPath) || extension === '.md') {
    return 'docs';
  }

  if (/(^|\/)(package\.json|tsconfig(?:\.[^/]+)?|vite\.config\.[^/]+|eslint\.config\.[^/]+|prettier\.config\.[^/]+|dockerfile|docker-compose(?:\.[^/]+)?|\.env(?:\.[^/]+)?|[^/]+\.(yaml|yml|toml|ini|cfg))$/.test(lowerPath) || /(^|\/)(vite|tsconfig|eslint|prettier)\.config\./.test(lowerPath)) {
    return 'config';
  }

  if (/(terraform|\.tf$|kubernetes|k8s|deployment|helm|\.github\/workflows|ci\/|devops|infra|infrastructure)/.test(lowerPath)) {
    return 'infra';
  }

  if (hasAnyPathToken(['prisma', 'typeorm', 'sequelize', 'knex', 'drizzle', 'mongoose', 'sqlalchemy', 'gorm', 'alembic', 'entity', 'migration', 'schema', 'model', 'repository', 'seed'])) {
    if (hasAnyPathToken(['prisma', 'typeorm', 'sequelize', 'knex', 'drizzle', 'mongoose', 'sqlalchemy', 'gorm', 'alembic'])) {
      return 'orm';
    }

    return 'database';
  }

  if (/(prisma|typeorm|sequelize|knex|drizzle|mongoose|sqlalchemy|gorm|alembic)/.test(lowerContent) && /(schema|migration|entity|model|db|database|prisma|orm)/.test(lowerPath)) {
    return 'orm';
  }

  if (/(components|pages|views|app\.|frontend|ui\/|client\/|web\/|main\.(tsx|jsx|js)$|index\.(tsx|jsx|js)$)/.test(lowerPath)) {
    return 'frontend';
  }

  if (/(routes|controllers|handlers|api\/|server|endpoint|resolver)/.test(lowerPath)) {
    return 'api';
  }

  if (/(services|service|usecase|domain|worker|processor|orchestrator|manager)/.test(lowerPath) || /class\s+\w+service\b/.test(lowerContent)) {
    return 'service';
  }

  if (/(utils|helpers|shared|common|lib\/|core\/)/.test(lowerPath)) {
    return 'shared';
  }

  if (/(script|scripts\/|bin\/)/.test(lowerPath)) {
    return 'script';
  }

  return 'unknown';
}

function buildRolePrompt(filePath, content, dependencyCount, exportCount) {
  const snippet = clampText(content.replace(/\s+/g, ' ').trim(), 2200);
  return [
    `File: ${filePath}`,
    `Imports: ${dependencyCount}`,
    `Exports: ${exportCount}`,
    `Content: ${snippet}`,
  ].join('\n');
}

async function classifyArchitectureRoleWithHuggingFace(filePath, content, dependencyCount, exportCount) {
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!token || typeof fetch !== 'function') {
    return null;
  }

  const candidateModels = [
    process.env.HF_MODEL,
    'MoritzLaurer/deberta-v3-large-zeroshot-v2.0',
    'facebook/bart-large-mnli',
  ].filter(Boolean);

  const prompt = buildRolePrompt(filePath, content, dependencyCount, exportCount);
  const labels = HF_ZERO_SHOT_LABELS;

  for (const modelName of candidateModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(modelName)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            candidate_labels: labels,
            multi_label: false,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const result = await response.json();
      const rankedLabels = Array.isArray(result?.labels) ? result.labels : [];
      if (rankedLabels.length > 0) {
        return String(rankedLabels[0]).toLowerCase();
      }
    } catch {
      // Fall through to the next model or heuristic fallback.
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function normalizeArchitectureRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (ARCHITECTURE_LABELS.includes(normalized)) {
    return normalized;
  }

  return 'unknown';
}

function roleToLayer(role) {
  switch (role) {
    case 'database':
    case 'orm':
      return 'data';
    case 'api':
      return 'interface';
    case 'service':
      return 'application';
    case 'frontend':
      return 'presentation';
    case 'shared':
      return 'shared';
    case 'config':
    case 'infra':
    case 'tests':
    case 'docs':
    case 'script':
      return 'support';
    default:
      return 'unknown';
  }
}

async function classifyArchitectureRole(filePath, content, extension, dependencyCount, exportCount) {
  const heuristicRole = inferArchitectureRoleHeuristically(filePath, content, extension);

  if (heuristicRole !== 'unknown' || !process.env.HF_TOKEN) {
    return heuristicRole;
  }

  const aiRole = await classifyArchitectureRoleWithHuggingFace(filePath, content, dependencyCount, exportCount);
  return normalizeArchitectureRole(aiRole);
}

export async function analyzeProject(rootPath) {
  const absoluteRoot = path.resolve(rootPath);
  const files = await fg(['**/*.{js,jsx,ts,tsx,mjs,cjs,py,go}'], {
    cwd: absoluteRoot,
    ignore: ['**/node_modules/**', '**/dist/**', '**/vendor/**', '**/.*/**'],
    absolute: true,
  });

  const nodes = [];
  const edges = [];
  const fileLookup = new Map();
  const groupCounts = new Map();
  const fileContents = new Map();

  for (const file of files) {
    const relativePath = normalizeRelativePath(absoluteRoot, file);
    const extension = path.extname(file).slice(1).toLowerCase();
    const content = fs.readFileSync(file, 'utf-8');
    const { dependencies, exports } = parseFile(content, path.extname(file).toLowerCase());
    const role = normalizeArchitectureRole(await classifyArchitectureRole(relativePath, content, path.extname(file).toLowerCase(), dependencies.length, exports.length));
    const layer = roleToLayer(role);

    if (HIDDEN_ROLES.has(role)) {
      continue;
    }

    fileLookup.set(relativePath, file);
    fileContents.set(relativePath, content);
    groupCounts.set(role, (groupCounts.get(role) ?? 0) + 1);

    nodes.push({
      id: relativePath,
      data: {
        label: relativePath,
        ext: extension,
        language: extension === 'tsx' || extension === 'ts' ? 'typescript' : extension === 'jsx' || extension === 'js' ? 'javascript' : extension === 'py' ? 'python' : extension === 'go' ? 'go' : extension,
        directory: toPosixPath(path.dirname(relativePath)),
        imports: 0,
        exports: 0,
        role,
        layer,
        kind: extension,
      },
      position: { x: 0, y: 0 },
    });
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]));

  for (const file of files) {
    const relativePath = normalizeRelativePath(absoluteRoot, file);
    const extension = path.extname(file).toLowerCase();
    const content = fileContents.get(relativePath) ?? fs.readFileSync(file, 'utf-8');
    const { dependencies, exports } = parseFile(content, extension);
    const language = extension === '.py' ? 'python' : extension === '.go' ? 'go' : 'js';
    const seenTargets = new Set();

    const node = nodeById.get(relativePath);
    if (node) {
      node.data.imports = dependencies.length;
      node.data.exports = exports.length;
      node.data.symbols = exports;
    }

    for (const dependency of dependencies) {
      const resolved = resolveDependency(absoluteRoot, file, dependency, language, fileLookup);
      if (!resolved || resolved === relativePath || seenTargets.has(resolved)) {
        continue;
      }

      seenTargets.add(resolved);
      edges.push({
        id: `edge-${relativePath}-${resolved}`,
        source: relativePath,
        target: resolved,
        label: 'imports',
        kind: 'imports',
        animated: true,
      });
    }
  }

  const architectureGroups = Array.from(groupCounts.entries())
    .map(([role, count]) => ({
      id: role,
      label: role === 'unknown' ? 'unclassified' : role,
      count,
      layer: roleToLayer(role),
    }))
    .sort((left, right) => right.count - left.count);

  return {
    nodes,
    edges,
    architectureGroups,
    generatedAt: new Date().toISOString(),
  };
}
