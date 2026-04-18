import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GraphData, NodeData } from '../types';
import FileNode from './FileNode';

const nodeTypes = { fileNode: FileNode };
type FlowNodeData = NodeData['data'];

const NODE_W = 240;
const NODE_H = 92;

function applyDagreLayout(nodes: Node[], edges: Edge[], rankdir: 'LR' | 'TB' = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir,
    nodesep: rankdir === 'TB' ? 28 : 42,
    ranksep: rankdir === 'TB' ? 80 : 120,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id) as { x: number; y: number };
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    } as Node<FlowNodeData>;
  });
}

function getModuleKey(node: Node<FlowNodeData>, graphMode?: string) {
  if ((graphMode ?? '').startsWith('architecture') || node.id.startsWith('arch:')) {
    const parts = node.id.split(':');
    return parts[1] || 'root';
  }

  const directory =
    node.data.directory && node.data.directory !== '.' ? node.data.directory : 'root';
  const [rootSegment] = directory.split('/');
  return rootSegment || 'root';
}

function applyModuleLaneLayout(nodes: Node<FlowNodeData>[], edges: Edge[], graphMode?: string) {
  if (nodes.length === 0) {
    return { nodes: [], moduleByNodeId: new Map<string, string>() };
  }

  const moduleBuckets = new Map<string, Node<FlowNodeData>[]>();
  const moduleByNodeId = new Map<string, string>();

  for (const node of nodes) {
    const moduleKey = getModuleKey(node, graphMode);
    moduleByNodeId.set(node.id, moduleKey);

    if (!moduleBuckets.has(moduleKey)) {
      moduleBuckets.set(moduleKey, []);
    }

    moduleBuckets.get(moduleKey)?.push(node);
  }

  const orderedModules = Array.from(moduleBuckets.entries())
    .sort((left, right) => right[1].length - left[1].length)
    .map(([module]) => module);

  const placements = orderedModules.map((moduleKey) => {
    const laneNodes = moduleBuckets.get(moduleKey) ?? [];
    const laneNodeIds = new Set(laneNodes.map((node) => node.id));
    const laneEdges = edges.filter(
      (edge) => laneNodeIds.has(edge.source) && laneNodeIds.has(edge.target)
    );
    const laneLayout = applyDagreLayout(laneNodes, laneEdges, 'TB');

    const minX = Math.min(...laneLayout.map((node) => node.position.x));
    const maxX = Math.max(...laneLayout.map((node) => node.position.x + NODE_W));
    const minY = Math.min(...laneLayout.map((node) => node.position.y));
    const maxY = Math.max(...laneLayout.map((node) => node.position.y + NODE_H));

    return {
      moduleKey,
      laneLayout,
      minX,
      minY,
      width: maxX - minX + 140,
      height: maxY - minY + 140,
    };
  });

  const columns = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(placements.length))));
  const rows = Math.ceil(placements.length / columns);
  const horizontalGap = 180;
  const verticalGap = 180;

  const columnWidths = Array.from({ length: columns }, (_, columnIndex) => {
    const inColumn = placements.filter((_, index) => index % columns === columnIndex);
    return inColumn.length > 0 ? Math.max(...inColumn.map((item) => item.width)) : 0;
  });

  const rowHeights = Array.from({ length: rows }, (_, rowIndex) => {
    const inRow = placements.slice(rowIndex * columns, (rowIndex + 1) * columns);
    return inRow.length > 0 ? Math.max(...inRow.map((item) => item.height)) : 0;
  });

  const columnOffsets = columnWidths.reduce<number[]>((offsets, _width, index) => {
    offsets[index] = index === 0 ? 0 : offsets[index - 1] + columnWidths[index - 1] + horizontalGap;
    return offsets;
  }, []);

  const rowOffsets = rowHeights.reduce<number[]>((offsets, _height, index) => {
    offsets[index] = index === 0 ? 0 : offsets[index - 1] + rowHeights[index - 1] + verticalGap;
    return offsets;
  }, []);

  const laidOutNodes: Node<FlowNodeData>[] = [];

  placements.forEach((placement, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const xOffset = columnOffsets[column] ?? 0;
    const yOffset = rowOffsets[row] ?? 0;
    const laneNudge = column % 2 === 0 ? 0 : 70;

    for (const node of placement.laneLayout) {
      laidOutNodes.push({
        ...node,
        position: {
          x: node.position.x - placement.minX + xOffset,
          y: node.position.y - placement.minY + yOffset + laneNudge,
        },
      });
    }
  });

  return { nodes: laidOutNodes, moduleByNodeId };
}

interface Props {
  data: GraphData;
  onNodeSelect: (node: NodeData) => void;
  selectedNodeId: string | null;
  query: string;
  minimumConnections: number;
  activeRole: string;
  layoutMode: 'modules' | 'global';
  theme: 'dark' | 'light';
}

export default function GraphCanvas({
  data,
  onNodeSelect,
  selectedNodeId,
  query,
  minimumConnections,
  activeRole,
  layoutMode,
  theme,
}: Props) {
  const baseNodes: Node<FlowNodeData>[] = useMemo(() => {
    const ts = performance.now();
    const mapped = data.nodes.map<Node<FlowNodeData>>((n) => ({
      id: n.id,
      type: 'fileNode',
      data: { ...n.data },
      position: n.position ?? { x: 0, y: 0 },
      draggable: true,
    }));
    console.log(`[PERF] baseNodes memo: ${(performance.now() - ts).toFixed(1)}ms`);
    return mapped;
  }, [data.nodes]);

  const [interactiveNodes, setInteractiveNodes] = useState<Node<FlowNodeData>[]>([]);

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

    return baseNodes.filter((node) => {
      const degree = degreeMap.get(node.id) ?? 0;
      const matchesRole = activeRole === 'all' || node.data.role === activeRole;
      const matchesQuery =
        !normalizedQuery ||
        node.id.toLowerCase().includes(normalizedQuery) ||
        node.data.label.toLowerCase().includes(normalizedQuery) ||
        node.data.ext.toLowerCase().includes(normalizedQuery);
      const matchesConnectivity = degree >= minimumConnections;

      return matchesRole && matchesQuery && matchesConnectivity;
    });
  }, [activeRole, baseNodes, degreeMap, minimumConnections, query]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((node) => node.id)),
    [filteredNodes]
  );

  const filteredEdges: Edge[] = useMemo(
    () =>
      data.edges
        .filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? 'imports',
          animated: false,
          type: 'smoothstep',
        })),
    [data.edges, filteredNodeIds]
  );

  const moduleLayout = useMemo(() => {
    if (layoutMode === 'modules') {
      return applyModuleLaneLayout(filteredNodes, filteredEdges, data.graphMode);
    }

    const globalNodes = applyDagreLayout(filteredNodes, filteredEdges, 'LR');
    const moduleByNodeId = new Map<string, string>();
    globalNodes.forEach((node) => {
      moduleByNodeId.set(node.id, getModuleKey(node, data.graphMode));
    });
    return { nodes: globalNodes, moduleByNodeId };
  }, [layoutMode, filteredNodes, filteredEdges, data.graphMode]);

  const styledEdges = useMemo(() => {
    const veryLargeGraph = filteredEdges.length > 1400;

    return filteredEdges
      .filter((edge) => {
        if (layoutMode !== 'modules' || !veryLargeGraph) {
          return true;
        }

        const sourceModule = moduleLayout.moduleByNodeId.get(edge.source);
        const targetModule = moduleLayout.moduleByNodeId.get(edge.target);
        return sourceModule !== targetModule;
      })
      .map((edge) => {
        const sourceModule = moduleLayout.moduleByNodeId.get(edge.source);
        const targetModule = moduleLayout.moduleByNodeId.get(edge.target);
        const crossModule = sourceModule !== targetModule;
        const hideEdgeLabel = filteredEdges.length > 260;

        return {
          ...edge,
          label: hideEdgeLabel ? undefined : edge.label,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: crossModule ? '#29c7ff' : theme === 'dark' ? '#5f6d7c' : '#8d96a2',
            width: crossModule ? 12 : 10,
            height: crossModule ? 12 : 10,
          },
          style: {
            stroke: crossModule ? '#29c7ff' : theme === 'dark' ? '#4d5968' : '#9aa3ad',
            strokeWidth: crossModule ? 1.35 : 0.85,
            opacity: crossModule ? 0.56 : 0.17,
          },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          labelStyle: {
            fill: theme === 'dark' ? '#d9ecff' : '#2b3a49',
            fontSize: 11,
            fontWeight: 600,
          },
        } as Edge;
      });
  }, [filteredEdges, layoutMode, moduleLayout.moduleByNodeId, theme]);

  const layoutNodes = useMemo(
    () =>
      moduleLayout.nodes.map((node) => ({
        ...node,
      })),
    [moduleLayout.nodes]
  );

  useEffect(() => {
    setInteractiveNodes(layoutNodes);
  }, [layoutNodes]);

  const displayedNodes = useMemo(
    () =>
      interactiveNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: node.id === selectedNodeId,
          theme,
        },
      })),
    [interactiveNodes, selectedNodeId, theme]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    console.log(`[DRAG] Node changes: ${changes.length} change(s)`);
    setInteractiveNodes(
      (currentNodes) => applyNodeChanges(changes, currentNodes) as Node<FlowNodeData>[]
    );
  }, []);

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
        key={`${data.generatedAt ?? 'empty'}-${filteredNodeIds.size}-${layoutMode}`}
        nodes={displayedNodes}
        edges={styledEdges}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        nodesDraggable
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
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
