import { ArrowUpRight, Code2, Filter, Layers3, LayoutGrid, RefreshCw, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import DetailPanel from './components/DetailPanel';
import GraphCanvas from './components/GraphCanvas';
import type { GraphData, NodeData } from './types';

const DEFAULT_GRAPH: GraphData = { nodes: [], edges: [], generatedAt: null };

export default function App() {
  const [graph, setGraph] = useState<GraphData>(DEFAULT_GRAPH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [minimumConnections, setMinimumConnections] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
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
    refreshGraph();
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    const updatedNode = graph.nodes.find(node => node.id === selectedNode.id);
    if (updatedNode) {
      setSelectedNode(updatedNode);
    }
  }, [graph.nodes, selectedNode]);

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
          </div>
          <div className="brand-copy">
            System-wide code relationships with a schematic, Eraser-inspired view.
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
          data={graph}
          onNodeSelect={setSelectedNode}
          selectedNodeId={selectedNode?.id ?? null}
          query={deferredQuery}
          minimumConnections={minimumConnections}
        />

        {loading && <div className="loading-overlay">Analyzing project structure...</div>}

        {selectedNode && (
          <aside className="detail-shell">
            <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          </aside>
        )}
      </main>
    </div>
  );
}
