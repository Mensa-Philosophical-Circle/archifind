export interface NodeData {
  id: string;
  data: {
    label: string;
    ext: string;
    language: string;
    directory: string;
    imports: number;
    exports: number;
    kind?: string;
    symbols?: string[];
    matched?: boolean;
    selected?: boolean;
    highlighted?: boolean;
  };
  position?: { x: number; y: number };
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
  generatedAt?: string | null;
}
