import {
  addEdge,
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useCallback, useEffect, useMemo } from 'react';
import type { GraphData, NodeData } from '../types';
import FileNode from './FileNode';

const nodeTypes = { fileNode: FileNode };
type FlowNodeData = NodeData['data'];

const NODE_W = 240;
const NODE_H = 92;

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 42, ranksep: 120, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id) as { x: number; y: number };
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } } as Node<FlowNodeData>;
  });
}

interface Props {
  data: GraphData;
  onNodeSelect: (node: NodeData) => void;
  selectedNodeId: string | null;
  query: string;
  minimumConnections: number;
  activeRole: string;
  stackMode: 'full' | 'frontend' | 'backend';
  theme: 'dark' | 'light';
}

export default function GraphCanvas({ data, onNodeSelect, selectedNodeId, query, minimumConnections, activeRole, stackMode, theme }: Props) {
  const rawNodes: Node<FlowNodeData>[] = useMemo(
    () =>
      data.nodes.map<Node<FlowNodeData>>(n => ({
        id: n.id,
        type: 'fileNode',
        data: { ...n.data, selected: n.id === selectedNodeId, theme },
        position: n.position ?? { x: 0, y: 0 },
      })),
    [data.nodes, selectedNodeId, theme]
  );

  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();

    data.edges.forEach((edge) => {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1);
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
    });

    return map;
  }, [data.edges]);

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const backendRoles = new Set(['api', 'service', 'database', 'orm']);

    return rawNodes.filter((node) => {
      const degree = degreeMap.get(node.id) ?? 0;
      const matchesRole = activeRole === 'all' || node.data.role === activeRole;
      const matchesStack = stackMode === 'full'
        ? true
        : stackMode === 'frontend'
          ? node.data.role === 'frontend' || node.data.layer === 'presentation'
          : backendRoles.has(node.data.role) || ['interface', 'application', 'data'].includes(node.data.layer);
      const matchesQuery = !normalizedQuery || node.id.toLowerCase().includes(normalizedQuery) || node.data.label.toLowerCase().includes(normalizedQuery) || node.data.ext.toLowerCase().includes(normalizedQuery);
      const matchesConnectivity = degree >= minimumConnections;

      return matchesRole && matchesStack && matchesQuery && matchesConnectivity;
    });
  }, [activeRole, degreeMap, minimumConnections, query, rawNodes, stackMode]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(node => node.id)), [filteredNodes]);

  const rawEdges: Edge[] = useMemo(
    () =>
      data.edges
        .filter(edge => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target))
        .map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? 'imports',
          animated: false,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8fd3ff', width: 12, height: 12 },
          style: { stroke: '#8fd3ff', strokeWidth: 1.4, opacity: 0.72 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 4,
          labelStyle: { fill: '#d9e8ff', fontSize: 11, fontWeight: 600 },
        })),
    [data.edges, filteredNodeIds]
  );

  const laidOutNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(laidOutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => {
    setNodes(applyDagreLayout(rawNodes, rawEdges));
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setEdges, setNodes]);

  const onConnect = useCallback(
    (params: any) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node<FlowNodeData>) => {
      onNodeSelect({
        id: node.id,
        data: node.data as NodeData['data'],
        position: node.position,
      });
    },
    [onNodeSelect]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        key={`${data.generatedAt ?? 'empty'}-${filteredNodeIds.size}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color={theme === 'dark' ? '#2b2b2b' : '#d0d0d0'} gap={28} size={1} />
        <Controls
          style={{
            background: theme === 'dark' ? '#0e0e0e' : '#ffffff',
            color: theme === 'dark' ? '#f5f5f5' : '#111111',
            border: `1px solid ${theme === 'dark' ? '#2f2f2f' : '#d6d6d6'}`,
            borderRadius: 10,
          }}
        />
        <MiniMap
          style={{
            background: theme === 'dark' ? '#090909' : '#ffffff',
            border: `1px solid ${theme === 'dark' ? '#2f2f2f' : '#d6d6d6'}`,
            borderRadius: 10,
          }}
          nodeColor={theme === 'dark' ? '#e5e5e5' : '#111111'}
          maskColor={theme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'}
        />
      </ReactFlow>
    </div>
  );
}
