import { Code2, File, GitBranch, Hash, X } from 'lucide-react';
import type { NodeData } from '../types';

const TYPE_COLORS: Record<string, string> = {
  ts: '#4f8cff',
  tsx: '#6fd5ff',
  js: '#f5c542',
  jsx: '#f5c542',
  py: '#61b5ff',
  go: '#3fd3d0',
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
  const ext = node.data.ext;
  const color = TYPE_COLORS[ext] ?? '#8ea2c7';
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
        <button className="close-btn" onClick={onClose} aria-label="Close details"><X size={14} /></button>
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

      <div className="detail-stats">
        <div>
          <GitBranch size={12} />
          <span>{node.data.imports} imports</span>
        </div>
        <div>
          <Code2 size={12} />
          <span>{node.data.exports} exports</span>
        </div>
      </div>

      <div className="detail-path-full">{node.id}</div>
    </div>
  );
}
