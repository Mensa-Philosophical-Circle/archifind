import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

const JS_RE = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;
const PY_RE = /(?:^|\n)\s*(?:import\s+([^\n,]+)|from\s+([^\s\n]+)\s+import)/g;
const GO_RE = /import\s+\(\s*[^)]+\s*\)|import\s+"([^"]+)"/g;

export async function analyzeProject(rootPath) {
  const files = await fg(['**/*.{js,jsx,ts,tsx,py,go}'], {
    cwd: rootPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/vendor/**', '**/.*/**'],
    absolute: true
  });

  const nodes = [];
  const edges = [];
  const fileToIndex = new Map();

  files.forEach((file, index) => {
    const relPath = path.relative(rootPath, file);
    nodes.push({
      id: relPath,
      data: { label: relPath, type: path.extname(file).slice(1) },
      position: { x: 0, y: 0 }
    });
    fileToIndex.set(relPath, index);
  });

  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const ext = path.extname(file);
    const relFile = path.relative(rootPath, file);
    const dir = path.dirname(relFile);

    let match;
    const deps = new Set();

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      while ((match = JS_RE.exec(content)) !== null) {
        deps.add(match[1]);
      }
    } else if (ext === '.py') {
      while ((match = PY_RE.exec(content)) !== null) {
        if (match[1]) match[1].split(',').forEach(d => deps.add(d.trim()));
        if (match[2]) deps.add(match[2]);
      }
    } else if (ext === '.go') {
       // Simple Go import extraction
       const goInline = /import\s+"([^"]+)"/g;
       while ((match = goInline.exec(content)) !== null) deps.add(match[1]);
       const goBlock = /import\s+\(([\s\S]*?)\)/g;
       while ((match = goBlock.exec(content)) !== null) {
         const block = match[1];
         const blockMatches = block.match(/"([^"]+)"/g);
         if (blockMatches) blockMatches.forEach(bm => deps.add(bm.replace(/"/g, '')));
       }
    }

    deps.forEach(dep => {
      // Resolve local paths roughly
      let resolved = null;
      if (dep.startsWith('.')) {
        const fullDep = path.join(path.dirname(file), dep);
        const relDep = path.relative(rootPath, fullDep);
        
        // Try various extensions
        const possible = [relDep, `${relDep}.js`, `${relDep}.ts`, `${relDep}.tsx`, `${relDep}/index.js`, `${relDep}/index.ts`];
        resolved = possible.find(p => fileToIndex.has(p));
      } else {
        // Simple search for name match in project (very naive)
        resolved = Array.from(fileToIndex.keys()).find(k => k.endsWith(dep) || k.includes(`${dep}/`));
      }

      if (resolved && resolved !== relFile) {
        edges.push({
          id: `e-${relFile}-${resolved}`,
          source: relFile,
          target: resolved,
          animated: true
        });
      }
    });
  });

  return { nodes, edges };
}
