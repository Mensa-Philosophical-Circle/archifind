import fg from "fast-glob";
import fs from "fs";
import path from "path";

const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const PY_EXTENSIONS = [".py"];
const GO_EXTENSIONS = [".go"];

const JS_IMPORT_RE = /^\s*import\s+[^'"\n]+from\s+['"]([^'"]+)['"]/gm;
const JS_SIDE_EFFECT_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]/gm;
const JS_REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const JS_EXPORT_FROM_RE =
  /^\s*export\s+(?:\*|\{[^\n]*\})\s+from\s+['"]([^'"]+)['"]/gm;
const JS_EXPORT_SYMBOL_RE =
  /^\s*export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const JS_NAMED_EXPORT_RE = /^\s*export\s*\{([^\n]+)\}/gm;

const PY_IMPORT_RE =
  /^\s*import\s+([\w.]+(?:\s+as\s+[\w.]+)?(?:\s*,\s*[\w.]+(?:\s+as\s+[\w.]+)?)*)/gm;
const PY_FROM_IMPORT_RE = /^\s*from\s+([\w.]+)\s+import\s+([\w.*(),\s]+)/gm;
const PY_DEF_RE = /^\s*(?:def|class)\s+([A-Za-z_][\w]*)/gm;

const GO_IMPORT_RE = /^\s*import\s+"([^"]+)"/gm;
const GO_IMPORT_BLOCK_RE = /import\s*\(([^)]+)\)/gm;

const ARCHITECTURE_LABELS = [
  "database",
  "orm",
  "api",
  "service",
  "frontend",
  "shared",
  "config",
  "infra",
  "tests",
  "docs",
  "script",
  "unknown",
];

const HF_ZERO_SHOT_LABELS = [
  "database",
  "orm",
  "api",
  "service",
  "frontend",
  "shared",
  "config",
  "infra",
  "tests",
  "docs",
  "script",
];

const HF_COMPONENT_LABELS = [
  "module",
  "api controller",
  "application service",
  "repository",
  "data model",
  "dto contract",
  "cross-cutting",
  "persistence",
  "configuration",
  "ui components",
  "ui pages",
  "ui state",
  "shared utilities",
  "shared contracts",
  "shared core",
  "unclassified",
];

const ROLE_COMPONENT_CANDIDATES = {
  api: [
    "api controller",
    "api interface",
    "api core",
    "cross-cutting",
    "dto contract",
  ],
  service: [
    "application service",
    "shared utilities",
    "shared core",
    "cross-cutting",
  ],
  database: ["repository", "data model", "data access", "persistence"],
  orm: ["persistence", "data model", "data migrations", "repository"],
  frontend: ["ui components", "ui pages", "ui state", "frontend core"],
  shared: [
    "shared utilities",
    "shared contracts",
    "shared core",
    "dto contract",
    "cross-cutting",
  ],
  unknown: HF_COMPONENT_LABELS,
};

const HIDDEN_ROLES = new Set(["config", "infra", "tests", "docs", "script"]);

function getHuggingFaceToken() {
  return (
    process.env.HF_TOKEN ||
    process.env.HUGGING_FACE_HUB_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    null
  );
}

async function runHuggingFaceChat(prompt, model = null) {
  const token = getHuggingFaceToken();
  if (!token) return null;

  const modelName =
    model || process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-72B-Instruct";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // Increased to 60s

    console.log(
      `[AI-CHAT] Sending chat request to ${modelName} (OpenAI-compatible)...`,
    );

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.1,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(
        `[AI-CHAT] API error from ${modelName}: ${response.status} ${response.statusText}`,
      );
      const errText = await response.text();
      console.log(`[AI-CHAT] Error body: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    if (content) {
      console.log(
        `[AI-SUCCESS] RECEIVED ARCHITECTURAL REASONING FROM ${modelName} (${content.length} chars)`,
      );
    }
    return content;
  } catch (error) {
    console.error(`[AI-CHAT] Fetch error: ${error.message}`);
    return null;
  }
}

function clampText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeRelativePath(rootPath, absolutePath) {
  return toPosixPath(path.relative(rootPath, absolutePath));
}

function createCandidatePaths(rootPath, filePath, dependency, language) {
  const candidates = new Set();
  const fileDir = path.dirname(filePath);
  const normalizedDependency = dependency.replace(/\\/g, "/");

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

  if (normalizedDependency.startsWith(".")) {
    addCandidatesFromBase(path.resolve(fileDir, normalizedDependency));
  } else if (language === "python" && normalizedDependency.startsWith("..")) {
    addCandidatesFromBase(path.resolve(fileDir, normalizedDependency));
  } else {
    const stripped = normalizedDependency
      .replace(/^@[^/]+\//, "")
      .replace(/^\/+/, "");

    addCandidatesFromBase(path.resolve(rootPath, stripped));
    addCandidatesFromBase(path.resolve(rootPath, stripped.replace(/\./g, "/")));
  }

  return Array.from(candidates).map((candidate) =>
    normalizeRelativePath(rootPath, candidate),
  );
}

function resolveDependency(rootPath, filePath, dependency, language, lookup) {
  const candidates = createCandidatePaths(
    rootPath,
    filePath,
    dependency,
    language,
  );

  for (const candidate of candidates) {
    if (lookup.has(candidate)) {
      return candidate;
    }
  }

  const dependencyStem = dependency
    .replace(/^@[^/]+\//, "")
    .replace(/^\.\/?/, "")
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs|py|go)$/, "")
    .split("/")
    .filter(Boolean)
    .pop();

  if (!dependencyStem) {
    return null;
  }

  return (
    Array.from(lookup.keys()).find((candidate) => {
      const candidateStem = path.basename(candidate, path.extname(candidate));
      return (
        candidateStem === dependencyStem ||
        candidate.endsWith(`/${dependencyStem}.py`) ||
        candidate.endsWith(`/${dependencyStem}.go`) ||
        candidate.endsWith(`/${dependencyStem}/index.js`) ||
        candidate.endsWith(`/${dependencyStem}/index.ts`)
      );
    }) ?? null
  );
}

function parseJavaScriptImports(content) {
  const dependencies = new Set();
  const exportedSymbols = new Set();

  for (const regex of [
    JS_IMPORT_RE,
    JS_SIDE_EFFECT_IMPORT_RE,
    JS_REQUIRE_RE,
    JS_EXPORT_FROM_RE,
  ]) {
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
      .split(",")
      .map((entry) => entry.trim())
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
      .split(",")
      .map((entry) => entry.trim())
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
      dependencies.add(entry.replace(/"/g, ""));
    });
  }

  return {
    dependencies: Array.from(dependencies),
    exports: [],
  };
}

function parseFile(content, extension) {
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(extension)) {
    return parseJavaScriptImports(content);
  }

  if (extension === ".py") {
    return parsePythonImports(content);
  }

  if (extension === ".go") {
    return parseGoImports(content);
  }

  return { dependencies: [], exports: [] };
}

function inferArchitectureRoleHeuristically(filePath, content, extension) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  const hasPathToken = (token) =>
    new RegExp(`(^|[/_.-])${token}([/_.-]|$)`).test(lowerPath);
  const hasAnyPathToken = (tokens) =>
    tokens.some((token) => hasPathToken(token));

  if (
    /(^|\/)cli\.(js|ts)$/.test(lowerPath) ||
    /(tools|scripts|bin)\//.test(lowerPath)
  ) {
    return "script";
  }

  if (/(^|\/)analyzer\.(js|ts)$/.test(lowerPath)) {
    return "service";
  }

  if (/(^|\/)server\.(js|ts)$/.test(lowerPath)) {
    return "api";
  }

  if (/(__tests__|\.test\.|\.spec\.|test\b|spec\b)/.test(lowerPath)) {
    return "tests";
  }

  if (
    /^(readme|changelog|license)|\.md$/.test(lowerPath) ||
    extension === ".md"
  ) {
    return "docs";
  }

  if (
    /(^|\/)(package\.json|tsconfig(?:\.[^/]+)?|vite\.config\.[^/]+|eslint\.config\.[^/]+|prettier\.config\.[^/]+|dockerfile|docker-compose(?:\.[^/]+)?|\.env(?:\.[^/]+)?|[^/]+\.(yaml|yml|toml|ini|cfg))$/.test(
      lowerPath,
    ) ||
    /(^|\/)(vite|tsconfig|eslint|prettier)\.config\./.test(lowerPath)
  ) {
    return "config";
  }

  if (
    /(terraform|\.tf$|kubernetes|k8s|deployment|helm|\.github\/workflows|ci\/|devops|infra|infrastructure)/.test(
      lowerPath,
    )
  ) {
    return "infra";
  }

  if (
    hasAnyPathToken([
      "prisma",
      "typeorm",
      "sequelize",
      "knex",
      "drizzle",
      "mongoose",
      "sqlalchemy",
      "gorm",
      "alembic",
      "entity",
      "migration",
      "schema",
      "model",
      "repository",
      "seed",
    ])
  ) {
    if (
      hasAnyPathToken([
        "prisma",
        "typeorm",
        "sequelize",
        "knex",
        "drizzle",
        "mongoose",
        "sqlalchemy",
        "gorm",
        "alembic",
      ])
    ) {
      return "orm";
    }

    return "database";
  }

  if (
    /(prisma|typeorm|sequelize|knex|drizzle|mongoose|sqlalchemy|gorm|alembic)/.test(
      lowerContent,
    ) &&
    /(schema|migration|entity|model|db|database|prisma|orm)/.test(lowerPath)
  ) {
    return "orm";
  }

  if (
    /(components|pages|views|app\.|frontend|ui\/|client\/|web\/|main\.(tsx|jsx|js)$|index\.(tsx|jsx|js)$)/.test(
      lowerPath,
    )
  ) {
    return "frontend";
  }

  if (
    /(routes|controllers|handlers|api\/|server|endpoint|resolver)/.test(
      lowerPath,
    )
  ) {
    return "api";
  }

  if (
    /(services|service|usecase|domain|worker|processor|orchestrator|manager)/.test(
      lowerPath,
    ) ||
    /class\s+\w+service\b/.test(lowerContent)
  ) {
    return "service";
  }

  if (/(utils|helpers|shared|common|lib\/|core\/)/.test(lowerPath)) {
    return "shared";
  }

  if (/(script|scripts\/|bin\/)/.test(lowerPath)) {
    return "script";
  }

  return "unknown";
}

function buildRolePrompt(filePath, content, dependencyCount, exportCount) {
  const snippet = clampText(content.replace(/\s+/g, " ").trim(), 2200);
  return [
    `File: ${filePath}`,
    `Imports: ${dependencyCount}`,
    `Exports: ${exportCount}`,
    `Content: ${snippet}`,
  ].join("\n");
}

function buildComponentPrompt(
  filePath,
  role,
  content,
  dependencyCount,
  exportCount,
) {
  const snippet = clampText(content.replace(/\s+/g, " ").trim(), 1800);
  return [
    `File: ${filePath}`,
    `Role: ${role}`,
    `Imports: ${dependencyCount}`,
    `Exports: ${exportCount}`,
    `Content: ${snippet}`,
  ].join("\n");
}

async function runHuggingFaceZeroShot(prompt, candidateLabels) {
  const token = getHuggingFaceToken();
  if (!token || typeof fetch !== "function") {
    console.log("[AI] HF token not available or fetch unavailable");
    return null;
  }

  const candidateModels = [
    process.env.HF_MODEL,
    "facebook/bart-large-mnli",
  ].filter(Boolean);

  for (const modelName of candidateModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // Increased to 30s

    try {
      console.log(
        `[AI-CHAT] Sending classification request to ${modelName} (${prompt.length} chars)...`,
      );
      const response = await fetch(
        `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(modelName)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              candidate_labels: candidateLabels,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        console.log(
          `[AI-CHAT] API error from ${modelName}: ${response.status} ${response.statusText}`,
        );
        continue;
      }

      const result = await response.json();
      let rankedLabels = [];

      if (Array.isArray(result)) {
        // The router often returns a list of { label, score } objects directly
        rankedLabels = result.map((item) => item.label).filter(Boolean);
      } else if (Array.isArray(result?.labels)) {
        // Some endpoints return { labels: [...], scores: [...] }
        rankedLabels = result.labels;
      }

      if (rankedLabels.length > 0) {
        const bestLabel = String(rankedLabels[0]).toLowerCase();
        const score = Array.isArray(result)
          ? result[0]?.score
          : result?.scores?.[0];
        console.log(
          `[AI] HF classified as: ${bestLabel} (score: ${score?.toFixed(3) ?? "N/A"})`,
        );
        return bestLabel;
      }
    } catch (err) {
      console.log(
        `[AI] HF API error for ${modelName}:`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  console.log("[AI] HF classification failed, falling back to heuristic");
  return null;
}

async function classifyArchitectureRoleWithHuggingFace(
  filePath,
  content,
  dependencyCount,
  exportCount,
) {
  const prompt = buildRolePrompt(
    filePath,
    content,
    dependencyCount,
    exportCount,
  );
  return runHuggingFaceZeroShot(prompt, HF_ZERO_SHOT_LABELS);
}

function normalizeArchitectureRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (ARCHITECTURE_LABELS.includes(normalized)) {
    return normalized;
  }

  return "unknown";
}

function normalizeArchitectureComponent(component) {
  const normalized = String(component || "")
    .toLowerCase()
    .trim();

  const aliases = {
    "api controller": "controller",
    "api interface": "api-interface",
    "api core": "api-core",
    "application service": "application-services",
    repository: "repository",
    "data model": "data-models",
    "data access": "data-access",
    "data migrations": "data-migrations",
    persistence: "persistence",
    module: "module",
    configuration: "configuration",
    "dto contract": "dto",
    "cross-cutting": "cross-cutting",
    "ui components": "ui-components",
    "ui pages": "ui-pages",
    "ui state": "ui-state",
    "frontend core": "frontend-core",
    "shared utilities": "shared-utils",
    "shared contracts": "shared-contracts",
    "shared core": "shared-core",
    unclassified: "unclassified",
  };

  return aliases[normalized] ?? null;
}

function componentToRole(component, fallbackRole = "unknown") {
  if (
    [
      "repository",
      "data-models",
      "data-access",
      "data-migrations",
      "persistence",
    ].includes(component)
  ) {
    return component === "persistence" || component === "data-migrations"
      ? "orm"
      : "database";
  }

  if (["controller", "api-interface", "api-core"].includes(component)) {
    return "api";
  }

  if (["application-services"].includes(component)) {
    return "service";
  }

  if (
    ["ui-components", "ui-pages", "ui-state", "frontend-core"].includes(
      component,
    )
  ) {
    return "frontend";
  }

  if (
    [
      "shared-utils",
      "shared-contracts",
      "shared-core",
      "dto",
      "cross-cutting",
      "configuration",
      "module",
    ].includes(component)
  ) {
    return "shared";
  }

  return fallbackRole;
}

async function classifyArchitectureComponentWithHuggingFace(
  filePath,
  role,
  content,
  dependencyCount,
  exportCount,
) {
  const labels = ROLE_COMPONENT_CANDIDATES[role] ?? HF_COMPONENT_LABELS;
  const prompt = buildComponentPrompt(
    filePath,
    role,
    content,
    dependencyCount,
    exportCount,
  );
  const result = await runHuggingFaceZeroShot(prompt, labels);
  return normalizeArchitectureComponent(result);
}

function roleToLayer(role) {
  switch (role) {
    case "database":
    case "orm":
      return "data";
    case "api":
      return "interface";
    case "service":
      return "application";
    case "frontend":
      return "presentation";
    case "shared":
      return "shared";
    case "config":
    case "infra":
    case "tests":
    case "docs":
    case "script":
      return "support";
    default:
      return "unknown";
  }
}

function normalizeFeatureName(filePath) {
  const segments = filePath.split("/");
  const srcIndex = segments.indexOf("src");
  const relevant = srcIndex >= 0 ? segments.slice(srcIndex + 1) : segments;
  const fileName = relevant[relevant.length - 1] ?? "";
  const folderSegments = relevant.slice(0, -1);

  if (folderSegments.length === 0) {
    if (/main\.(t|j)sx?$/.test(fileName)) {
      return "bootstrap";
    }

    if (/app\.module\.(t|j)sx?$/.test(fileName)) {
      return "app";
    }

    return "root";
  }

  return folderSegments[0];
}

function toReadableLabel(value) {
  return String(value || "")
    .replace(/[:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function componentLabel(component) {
  const map = {
    module: "Module",
    controller: "API Controller",
    service: "Application Service",
    repository: "Repository",
    entity: "Data Model",
    dto: "DTO Contract",
    "cross-cutting": "Cross-Cutting",
    persistence: "Persistence",
    configuration: "Configuration",
    "ui-components": "UI Components",
    "ui-pages": "UI Pages",
    "ui-state": "UI State",
    "frontend-core": "Frontend Core",
    "api-interface": "API Interface",
    "api-core": "API Core",
    "application-services": "Application Services",
    "data-migrations": "Data Migrations",
    "data-models": "Data Models",
    "data-repositories": "Data Repositories",
    "data-access": "Data Access",
    "shared-utils": "Shared Utilities",
    "shared-contracts": "Shared Contracts",
    "shared-core": "Shared Core",
    unclassified: "Unclassified",
    support: "Support",
  };

  return map[component] ?? toReadableLabel(component);
}

function inferArchitectureComponent(filePath, role) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".module.ts") || lower.endsWith(".module.js")) {
    return { component: "module", role: "shared" };
  }

  if (
    lower.endsWith(".controller.ts") ||
    lower.endsWith(".controller.js") ||
    lower.endsWith(".resolver.ts") ||
    lower.endsWith(".resolver.js") ||
    lower.endsWith(".gateway.ts") ||
    lower.endsWith(".gateway.js")
  ) {
    return { component: "controller", role: "api" };
  }

  if (
    lower.endsWith(".service.ts") ||
    lower.endsWith(".service.js") ||
    lower.includes("/services/")
  ) {
    return { component: "service", role: "service" };
  }

  if (
    lower.endsWith(".repository.ts") ||
    lower.endsWith(".repository.js") ||
    lower.includes("/repositories/") ||
    lower.includes("/repository/")
  ) {
    return { component: "repository", role: "database" };
  }

  if (
    lower.endsWith(".entity.ts") ||
    lower.endsWith(".entity.js") ||
    lower.endsWith(".schema.ts") ||
    lower.endsWith(".schema.js") ||
    lower.includes("/entities/") ||
    lower.includes("/schemas/")
  ) {
    return { component: "entity", role: "database" };
  }

  if (
    lower.endsWith(".dto.ts") ||
    lower.endsWith(".dto.js") ||
    lower.includes("/dto/")
  ) {
    return { component: "dto", role: "shared" };
  }

  if (
    lower.endsWith(".guard.ts") ||
    lower.endsWith(".guard.js") ||
    lower.endsWith(".pipe.ts") ||
    lower.endsWith(".pipe.js") ||
    lower.endsWith(".interceptor.ts") ||
    lower.endsWith(".interceptor.js") ||
    lower.endsWith(".filter.ts") ||
    lower.endsWith(".filter.js") ||
    lower.endsWith(".middleware.ts") ||
    lower.endsWith(".middleware.js") ||
    lower.includes("/guards/") ||
    lower.includes("/pipes/") ||
    lower.includes("/interceptors/") ||
    lower.includes("/filters/") ||
    lower.includes("/middleware/")
  ) {
    return { component: "cross-cutting", role: "shared" };
  }

  if (
    lower.includes("/prisma/") ||
    lower.includes("/typeorm/") ||
    lower.includes("/sequelize/") ||
    lower.includes("/migrations/") ||
    lower.endsWith(".migration.ts") ||
    lower.endsWith(".migration.js") ||
    lower.includes("/seed")
  ) {
    return { component: "persistence", role: "orm" };
  }

  if (lower.includes("/config/")) {
    return { component: "configuration", role: "shared" };
  }

  if (role === "frontend") {
    if (lower.includes("/components/")) {
      return { component: "ui-components", role: "frontend" };
    }

    if (
      lower.includes("/pages/") ||
      lower.includes("/views/") ||
      lower.includes("/screens/")
    ) {
      return { component: "ui-pages", role: "frontend" };
    }

    if (
      lower.includes("/hooks/") ||
      lower.includes("/store/") ||
      lower.includes("/state/") ||
      lower.includes("/context/")
    ) {
      return { component: "ui-state", role: "frontend" };
    }

    return { component: "frontend-core", role: "frontend" };
  }

  if (role === "api") {
    if (
      lower.includes("/routes/") ||
      lower.includes("/controllers/") ||
      lower.includes("/handlers/")
    ) {
      return { component: "api-interface", role: "api" };
    }

    return { component: "api-core", role: "api" };
  }

  if (role === "service") {
    return { component: "application-services", role: "service" };
  }

  if (role === "database" || role === "orm") {
    if (
      lower.includes("/migration") ||
      lower.includes("/seed") ||
      lower.endsWith(".migration.ts") ||
      lower.endsWith(".migration.js")
    ) {
      return { component: "data-migrations", role: "orm" };
    }

    if (
      lower.includes("/entity") ||
      lower.includes("/model") ||
      lower.includes("/schema")
    ) {
      return { component: "data-models", role: role };
    }

    if (lower.includes("/repository") || lower.includes("/dao/")) {
      return { component: "data-repositories", role: "database" };
    }

    return { component: "data-access", role: role };
  }

  if (role === "shared") {
    if (
      lower.includes("/utils/") ||
      lower.includes("/helpers/") ||
      lower.includes("/lib/")
    ) {
      return { component: "shared-utils", role: "shared" };
    }

    if (
      lower.includes("/types/") ||
      lower.includes("/interfaces/") ||
      lower.includes("/dto/")
    ) {
      return { component: "shared-contracts", role: "shared" };
    }

    return { component: "shared-core", role: "shared" };
  }

  if (role === "unknown") {
    return { component: "unclassified", role: "unknown" };
  }

  return { component: "support", role: "shared" };
}

function buildArchitectureGraph(fileRecords, fileEdges) {
  const blockMap = new Map();
  const fileToBlock = new Map();

  const ensureBlock = (blockId, feature, component, role) => {
    if (!blockMap.has(blockId)) {
      blockMap.set(blockId, {
        id: blockId,
        data: {
          label: `${toReadableLabel(feature)} • ${componentLabel(component)}`,
          ext: "arch",
          language: "architecture",
          directory: feature,
          moduleLabel: toReadableLabel(feature),
          componentLabel: componentLabel(component),
          imports: 0,
          exports: 0,
          role,
          layer: roleToLayer(role),
          kind: component,
          symbols: [],
          files: [],
        },
        position: { x: 0, y: 0 },
      });
    }

    return blockMap.get(blockId);
  };

  for (const record of fileRecords) {
    const feature = normalizeFeatureName(record.id);
    const componentInfo = {
      component:
        record.component ??
        inferArchitectureComponent(record.id, record.role).component,
      role:
        record.componentRole ??
        inferArchitectureComponent(record.id, record.role).role,
    };
    const blockId = `arch:${feature}:${componentInfo.component}`;
    const block = ensureBlock(
      blockId,
      feature,
      componentInfo.component,
      componentInfo.role,
    );

    fileToBlock.set(record.id, blockId);
    block.data.imports += record.dependencies.length;
    block.data.exports += record.exports.length;

    if (block.data.files.length < 10) {
      block.data.files.push(record.id);
    }

    if (record.exports.length > 0 && block.data.symbols.length < 24) {
      const remaining = 24 - block.data.symbols.length;
      block.data.symbols.push(...record.exports.slice(0, remaining));
    }
  }

  const archEdgeMap = new Map();

  for (const edge of fileEdges) {
    const sourceBlock = fileToBlock.get(edge.source);
    const targetBlock = fileToBlock.get(edge.target);

    if (!sourceBlock || !targetBlock || sourceBlock === targetBlock) {
      continue;
    }

    const edgeId = `arch-edge-${sourceBlock}-${targetBlock}`;
    const existing = archEdgeMap.get(edgeId);
    if (existing) {
      existing.weight += 1;
    } else {
      archEdgeMap.set(edgeId, {
        id: edgeId,
        source: sourceBlock,
        target: targetBlock,
        kind: "aggregated-imports",
        weight: 1,
      });
    }
  }

  const nodes = Array.from(blockMap.values());
  const edges = Array.from(archEdgeMap.values()).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: `${edge.weight} deps`,
    kind: edge.kind,
    animated: false,
  }));

  const groupCounts = new Map();
  nodes.forEach((node) => {
    const role = node.data.role;
    groupCounts.set(role, (groupCounts.get(role) ?? 0) + 1);
  });

  const architectureGroups = Array.from(groupCounts.entries())
    .map(([role, count]) => ({
      id: role,
      label: role === "unknown" ? "unclassified" : role,
      count,
      layer: roleToLayer(role),
    }))
    .sort((left, right) => right.count - left.count);

  return {
    nodes,
    edges,
    architectureGroups,
    mode: "architecture",
  };
}

async function classifyArchitectureRole(
  filePath,
  content,
  extension,
  dependencyCount,
  exportCount,
) {
  const aiAssistEnabled =
    String(process.env.archifind_AI_ASSIST ?? "true").toLowerCase() !== "false";
  const heuristicRole = inferArchitectureRoleHeuristically(
    filePath,
    content,
    extension,
  );

  if (aiAssistEnabled && getHuggingFaceToken()) {
    const aiRole = await classifyArchitectureRoleWithHuggingFace(
      filePath,
      content,
      dependencyCount,
      exportCount,
    );
    const normalizedAiRole = normalizeArchitectureRole(aiRole);

    // Use AI result if it's not unknown, otherwise fallback to heuristic
    if (normalizedAiRole !== "unknown") {
      console.log(
        `[ROLE] ${filePath}: AI=${normalizedAiRole} (was heuristic: ${heuristicRole})`,
      );
      return normalizedAiRole;
    }
  }

  // Fallback: use heuristic if AI is disabled, no token, or AI returned unknown
  return heuristicRole;
}

async function classifyArchitectureComponent(
  filePath,
  role,
  content,
  dependencyCount,
  exportCount,
) {
  const aiComponentsEnabled =
    String(process.env.archifind_AI_COMPONENTS ?? "true").toLowerCase() !==
    "false";
  const heuristicComponent = inferArchitectureComponent(filePath, role);

  if (aiComponentsEnabled && getHuggingFaceToken()) {
    const aiComponent = await classifyArchitectureComponentWithHuggingFace(
      filePath,
      role,
      content,
      dependencyCount,
      exportCount,
    );

    if (aiComponent && aiComponent !== "unclassified") {
      const aiRole = componentToRole(aiComponent, role);
      return { component: aiComponent, role: aiRole };
    }
  }

  return heuristicComponent;
}

function summarizeProjectSkeleton(fileRecords) {
  const summary = fileRecords
    .map((r) => {
      const deps = r.dependencies.slice(0, 5).join(", ");
      const exps = r.exports.slice(0, 5).join(", ");
      return `- ${r.id} | ext=${path.extname(r.id)} | deps=[${deps}] | exports=[${exps}]`;
    })
    .join("\n");

  return summary;
}

async function generateArchitectureWithAi(fileRecords) {
  const skeleton = summarizeProjectSkeleton(fileRecords);
  console.log(`[AI] Project skeleton generated (${fileRecords.length} files).`);
  console.log(
    `[AI] SENDING TO MODEL:\n${skeleton.slice(0, 500)}...\n[...truncated...]`,
  );

  const prompt = `
You are a Senior Software Architect. Analyze the following project structure and return a JSON architecture map.
Follow "Eraser.io" aesthetic: high-level, clean, and grouped by functional domains.

Project Skeleton:
${skeleton}

Return ONLY a JSON object with this structure:
{
  "nodes": [{"id": "arch:domain:component", "data": {"label": "Component Name", "role": "api|service|database|frontend|shared", "kind": "component", "symbols": ["symbol1", "symbol2"], "files": ["path/to/file.ts"]}}],
  "edges": [{"source": "arch:A", "target": "arch:B", "label": "descriptive relation"}],
  "architectureGroups": [{"id": "role", "label": "Group Label", "count": 1, "layer": "data|interface|application|presentation|shared|support"}]
}

Rules:
1. Aggregate files into logical "arch:" nodes.
2. Every file in the skeleton MUST be assigned to at least one arch node's "files" array.
3. Use professional naming (e.g., "Authentication Service" instead of "auth.ts").
4. "role" must be one of: api, service, database, frontend, shared.
5. "layer" must be one of: data, interface, application, presentation, shared, support.

JSON:
`;

  console.log("[AI] Requesting architectural reasoning from LLM...");
  const response = await runHuggingFaceChat(prompt);
  if (!response) {
    console.log("[AI] ERROR: No response from model.");
    return null;
  }

  console.log(
    `[AI] RECEIVED FROM MODEL:\n${response.slice(0, 1000)}...\n[...truncated...]`,
  );

  try {
    // Basic cleanup in case AI wraps in code blocks
    const jsonStr = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const graph = JSON.parse(jsonStr);
    return {
      ...graph,
      mode: "architecture",
      generatedBy: "AI-Native",
    };
  } catch (err) {
    console.log("[AI] Failed to parse AI response as JSON:", err.message);
    return null;
  }
}

export async function analyzeProject(rootPath, options = {}) {
  const absoluteRoot = path.resolve(rootPath);
  const MAX_FILE_SIZE = 500 * 1024;
  const MAX_NODES = 1000;

  const includeEnv = Boolean(
    options.includeEnv ?? process.env.ARCHIFIND_INCLUDE_ENV === "true",
  );
  const searchPatterns = ["**/*.{js,jsx,ts,tsx,mjs,cjs,py,go}"];
  const ignorePatterns = [
    "**/node_modules/**",
    "**/dist/**",
    "**/vendor/**",
    "**/.*/**",
  ];

  if (includeEnv) {
    searchPatterns.push("**/.env*");
  } else {
    ignorePatterns.push("**/.env*");
  }

  const files = await fg(searchPatterns, {
    cwd: absoluteRoot,
    ignore: ignorePatterns,
    absolute: true,
    dot: true,
  });

  const nodes = [];
  const fileEdges = [];
  const fileLookup = new Map();
  const groupCounts = new Map();
  const fileRecords = [];
  const requestedGraphMode = String(
    options.graphMode || process.env.archifind_GRAPH_MODE || "architecture",
  ).toLowerCase();

  for (const file of files) {
    if (nodes.length >= MAX_NODES) break;

    let stat;
    try {
      stat = fs.statSync(file);
      if (stat.size > MAX_FILE_SIZE) {
        continue;
      }
    } catch {
      continue;
    }

    const relativePath = normalizeRelativePath(absoluteRoot, file);
    const extension = path.extname(file).slice(1).toLowerCase();

    let content;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const { dependencies, exports } = parseFile(
      content,
      path.extname(file).toLowerCase(),
    );
    const role = normalizeArchitectureRole(
      await classifyArchitectureRole(
        relativePath,
        content,
        path.extname(file).toLowerCase(),
        dependencies.length,
        exports.length,
      ),
    );
    const componentInfo = await classifyArchitectureComponent(
      relativePath,
      role,
      content,
      dependencies.length,
      exports.length,
    );
    const layer = roleToLayer(role);

    if (HIDDEN_ROLES.has(role)) {
      continue;
    }

    fileLookup.set(relativePath, file);
    groupCounts.set(role, (groupCounts.get(role) ?? 0) + 1);

    const node = {
      id: relativePath,
      data: {
        label: relativePath,
        ext: extension,
        language:
          extension === "tsx" || extension === "ts"
            ? "typescript"
            : extension === "jsx" || extension === "js"
              ? "javascript"
              : extension === "py"
                ? "python"
                : extension === "go"
                  ? "go"
                  : extension,
        directory: toPosixPath(path.dirname(relativePath)),
        imports: dependencies.length,
        exports: exports.length,
        role,
        layer,
        kind: extension,
        symbols: exports.slice(0, 8),
      },
      position: { x: 0, y: 0 },
    };

    nodes.push(node);
    fileRecords.push({
      id: relativePath,
      file,
      extension: path.extname(file).toLowerCase(),
      dependencies,
      exports,
      role,
      layer,
      component: componentInfo.component,
      componentRole: componentInfo.role,
    });
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const record of fileRecords) {
    const file = record.file;
    const relativePath = record.id;
    const extension = record.extension;
    const dependencies = record.dependencies;
    const language =
      extension === ".py" ? "python" : extension === ".go" ? "go" : "js";
    const seenTargets = new Set();

    const node = nodeById.get(relativePath);
    if (node) {
      node.data.symbols = record.exports.slice(0, 8);
    }

    for (const dependency of dependencies) {
      const resolved = resolveDependency(
        absoluteRoot,
        file,
        dependency,
        language,
        fileLookup,
      );
      if (!resolved || resolved === relativePath || seenTargets.has(resolved)) {
        continue;
      }

      seenTargets.add(resolved);
      fileEdges.push({
        id: `edge-${relativePath}-${resolved}`,
        source: relativePath,
        target: resolved,
        label: "imports",
        kind: "imports",
        animated: true,
      });
    }
  }

  if (requestedGraphMode !== "file") {
    const useAiNative =
      String(
        process.env.archifind_AI_NATIVE ?? options.aiNative ?? "true",
      ).toLowerCase() === "true";

    if (useAiNative && getHuggingFaceToken()) {
      const aiGraph = await generateArchitectureWithAi(fileRecords);
      if (aiGraph) {
        return {
          ...aiGraph,
          generatedAt: new Date().toISOString(),
        };
      }
      console.log("[AI] Falling back to heuristic architecture generation");
    }

    const architectureGraph = buildArchitectureGraph(fileRecords, fileEdges);
    return {
      nodes: architectureGraph.nodes,
      edges: architectureGraph.edges,
      architectureGroups: architectureGraph.architectureGroups,
      graphMode: architectureGraph.mode,
      generatedAt: new Date().toISOString(),
    };
  }

  const architectureGroups = Array.from(groupCounts.entries())
    .map(([role, count]) => ({
      id: role,
      label: role === "unknown" ? "unclassified" : role,
      count,
      layer: roleToLayer(role),
    }))
    .sort((left, right) => right.count - left.count);

  return {
    nodes,
    edges: fileEdges,
    architectureGroups,
    graphMode: "file-dependency",
    generatedAt: new Date().toISOString(),
  };
}
