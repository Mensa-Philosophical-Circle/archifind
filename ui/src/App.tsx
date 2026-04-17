import { ArrowUpRight, Code2, Filter, Layers3, LayoutGrid, MoonStar, RefreshCw, Search, SunMedium, Workflow } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import DetailPanel from './components/DetailPanel';
import GraphCanvas from './components/GraphCanvas';
import type { GraphData, NodeData } from './types';

const DEFAULT_GRAPH: GraphData = { nodes: [], edges: [], generatedAt: null };
const THEME_STORAGE_KEY = 'archfind-theme';

const DEFAULT_ROLE_ORDER = ['database', 'orm', 'api', 'service', 'frontend', 'shared', 'config', 'infra', 'tests', 'docs', 'script', 'unknown'];
const BACKEND_LAYERS = new Set(['interface', 'application', 'data']);

function roleVisibleInStack(layer: string, role: string, stackMode: 'full' | 'frontend' | 'backend') {
  if (stackMode === 'full') {
    return true;
  }

  if (stackMode === 'frontend') {
    return layer === 'presentation' || role === 'frontend';
  }

  return BACKEND_LAYERS.has(layer) || ['api', 'service', 'database', 'orm'].includes(role);
}

export default function App() {
  const [graph, setGraph] = useState<GraphData>(DEFAULT_GRAPH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [minimumConnections, setMinimumConnections] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [activeRole, setActiveRole] = useState<string>('all');
  const [stackMode, setStackMode] = useState<'full' | 'frontend' | 'backend'>('full');
  const deferredQuery = useDeferredValue(query);

  const refreshGraph = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graph');
      if (!response.ok) {
        throw new Error(`Failed to load graph (${response.status})`);
      }

      const data = await response.json();
      setGraph(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshGraph();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const selectedNode = useMemo<NodeData | null>(() => {
    if (!selectedNodeId) {
      return null;
    }

    return graph.nodes.find(node => node.id === selectedNodeId) ?? null;
  }, [graph.nodes, selectedNodeId]);

  const stats = useMemo(() => {
    const extCounts = graph.nodes.reduce<Record<string, number>>((accumulator, node) => {
      accumulator[node.data.ext] = (accumulator[node.data.ext] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      files: graph.nodes.length,
      edges: graph.edges.length,
      languages: Object.keys(extCounts).length,
    };
  }, [graph.edges.length, graph.nodes]);

  const architectureGroups = useMemo(() => {
    const counts = new Map<string, number>();
    const layers = new Map<string, string>();

    graph.nodes.forEach((node) => {
      const role = node.data.role;
      const layer = node.data.layer;

      if (!roleVisibleInStack(layer, role, stackMode)) {
        return;
      }

      counts.set(role, (counts.get(role) ?? 0) + 1);
      if (!layers.has(role)) {
        layers.set(role, layer);
      }
    });

    const ordered = DEFAULT_ROLE_ORDER
      .filter(role => counts.has(role))
      .map(role => ({
        id: role,
        label: role,
        count: counts.get(role) ?? 0,
        layer: layers.get(role) ?? role,
      }));

    const extras = Array.from(counts.keys())
      .filter(role => !DEFAULT_ROLE_ORDER.includes(role))
      .sort()
      .map(role => ({
        id: role,
        label: role,
        count: counts.get(role) ?? 0,
        layer: layers.get(role) ?? role,
      }));

    return [...ordered, ...extras];
  }, [graph.nodes, stackMode]);

  const effectiveActiveRole = useMemo(() => {
    if (activeRole === 'all') {
      return 'all';
    }

    return architectureGroups.some(group => group.id === activeRole) ? activeRole : 'all';
  }, [activeRole, architectureGroups]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-row">
            <div className="brand-mark">
              <LayoutGrid size={18} />
            </div>
            <div>
              <div className="brand-title">archfind</div>
              <div className="brand-subtitle">architecture map</div>
            </div>
            <button
              className="theme-toggle"
              onClick={() => setTheme(currentTheme => (currentTheme === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <SunMedium size={14} /> : <MoonStar size={14} />}
            </button>
          </div>
          <div className="brand-copy">
            System-wide code relationships with a monochrome architecture view.
          </div>
        </div>

        <div className="toolbar-card">
          <label className="search-box">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search files, folders, or extensions"
            />
          </label>

          <label className="filter-row">
            <span>
              <Filter size={14} />
              Minimum connectivity: {minimumConnections}
            </span>
            <input
              type="range"
              min="0"
              max="8"
              value={minimumConnections}
              onChange={event => setMinimumConnections(Number(event.target.value))}
            />
          </label>

          <button className="refresh-btn" onClick={refreshGraph}>
            <RefreshCw size={14} />
            Refresh graph
          </button>
        </div>

        <div className="stack-switch" role="tablist" aria-label="Architecture view mode">
          <button
            className={stackMode === 'full' ? 'stack-btn active' : 'stack-btn'}
            onClick={() => {
              setStackMode('full');
              setActiveRole('all');
            }}
          >
            Full stack
          </button>
          <button
            className={stackMode === 'frontend' ? 'stack-btn active' : 'stack-btn'}
            onClick={() => {
              setStackMode('frontend');
              setActiveRole('all');
            }}
          >
            Frontend
          </button>
          <button
            className={stackMode === 'backend' ? 'stack-btn active' : 'stack-btn'}
            onClick={() => {
              setStackMode('backend');
              setActiveRole('all');
            }}
          >
            Backend
          </button>
        </div>

        <div className="filter-hint">
          Scope first, then role: the top toggle chooses frontend/backend/full-stack, and chips below narrow roles inside that scope.
        </div>

        <div className="role-strip">
          <button className={effectiveActiveRole === 'all' ? 'role-chip active' : 'role-chip'} onClick={() => setActiveRole('all')}>
            <Workflow size={13} />
            All
          </button>
          {architectureGroups.map(group => (
            <button
              key={group.id}
              className={effectiveActiveRole === group.id ? 'role-chip active' : 'role-chip'}
              onClick={() => setActiveRole(group.id)}
              title={group.layer}
            >
              <span>{group.label}</span>
              <span className="role-count">{group.count}</span>
            </button>
          ))}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <Code2 size={16} />
            <div>
              <span className="stat-value">{stats.files}</span>
              <span className="stat-label">Files</span>
            </div>
          </div>
          <div className="stat-card">
            <ArrowUpRight size={16} />
            <div>
              <span className="stat-value">{stats.edges}</span>
              <span className="stat-label">Edges</span>
            </div>
          </div>
          <div className="stat-card">
            <Layers3 size={16} />
            <div>
              <span className="stat-value">{stats.languages}</span>
              <span className="stat-label">Languages</span>
            </div>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="sidebar-footer">
          <span>Updated {graph.generatedAt ? new Date(graph.generatedAt).toLocaleTimeString() : 'just now'}</span>
          <span>{deferredQuery ? `Filtering: ${deferredQuery}` : 'All files visible'}</span>
        </div>
      </aside>

      <main className="canvas-shell">
        <GraphCanvas
          key={graph.generatedAt ?? 'empty'}
          data={graph}
          onNodeSelect={(node) => setSelectedNodeId(node?.id ?? null)}
          selectedNodeId={selectedNodeId}
          query={deferredQuery}
          minimumConnections={minimumConnections}
          activeRole={effectiveActiveRole}
          stackMode={stackMode}
          theme={theme}
        />

        {loading && <div className="loading-overlay">Analyzing project structure...</div>}

        {selectedNode && (
          <aside className="detail-shell">
            <DetailPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          </aside>
        )}
      </main>
    </div>
  );
}
