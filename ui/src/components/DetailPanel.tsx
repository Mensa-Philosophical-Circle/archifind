import { X, File, Code2, Hash } from 'lucide-react';
import type { NodeData } from '../types';

const TYPE_COLORS: Record<string, string> = {
  ts: '#3178c6',
  tsx: '#61dafb',
  js: '#f7df1e',
  jsx: '#61dafb',
  py: '#3572A5',
  go: '#00ADD8',
};

const EXT_ICON: Record<string, string> = {
  ts: 'TS',
  tsx: 'TSX',
  js: 'JS',
  jsx: 'JSX',
  py: 'PY',
  go: 'GO',
};

interface Props {
  node: NodeData;
  onClose: () => void;
}

export default function DetailPanel({ node, onClose }: Props) {
  const ext = node.data.type;
  const color = TYPE_COLORS[ext] ?? '#a0a0b0';
  const badge = EXT_ICON[ext] ?? ext.toUpperCase();
  const parts = node.id.split('/');
  const fileName = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-title">
          <File size={14} />
          <span>File Details</span>
        </div>
        <button className="close-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="detail-badge" style={{ borderColor: color, color }}>
        <Code2 size={12} />
        <span>{badge}</span>
      </div>

      <div className="detail-filename">{fileName}</div>

      {dir && (
        <div className="detail-dir">
          <Hash size={11} />
          <span>{dir}</span>
        </div>
      )}

      <div className="detail-path-full">{node.id}</div>
    </div>
  );
}
