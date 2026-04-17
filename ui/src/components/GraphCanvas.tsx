import { useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  ConnectionLineType,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { GraphData, NodeData } from '../types';
import FileNode from './FileNode';

const nodeTypes = { fileNode: FileNode };

const NODE_W = 200;
const NODE_H = 48;

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

interface Props {
  data: GraphData;
  onNodeSelect: (node: NodeData) => void;
  selectedNodeId: string | null;
}

export default function GraphCanvas({ data, onNodeSelect, selectedNodeId }: Props) {
  const rawNodes: Node[] = useMemo(
    () =>
      data.nodes.map(n => ({
        id: n.id,
        type: 'fileNode',
        data: { ...n.data, selected: n.id === selectedNodeId },
        position: n.position,
      })),
    [data.nodes, selectedNodeId]
  );

  const rawEdges: Edge[] = useMemo(
    () =>
      data.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5', width: 12, height: 12 },
        style: { stroke: '#4f46e5', strokeWidth: 1.5, opacity: 0.6 },
      })),
    [data.edges]
  );

  const laidOutNodes = useMemo(() => applyDagreLayout(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => {
    setNodes(applyDagreLayout(rawNodes, rawEdges));
  }, [rawNodes, rawEdges]);

  useEffect(() => {
    setEdges(rawEdges);
  }, [rawEdges]);

  const onConnect = useCallback(
    (params: any) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e1e2e" gap={28} size={1} />
        <Controls
          style={{
            background: '#1a1a2e',
            border: '1px solid #2d2d4e',
            borderRadius: 10,
          }}
        />
        <MiniMap
          style={{
            background: '#0d0d1a',
            border: '1px solid #2d2d4e',
            borderRadius: 10,
          }}
          nodeColor="#4f46e5"
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
}
