export interface NodeData {
  id: string;
  data: {
    label: string;
    type: string;
  };
  position: { x: number; y: number };
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}
