import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const EXT_COLOR: Record<string, string> = {
  ts: '#3178c6',
  tsx: '#61dafb',
  js: '#f0db4f',
  jsx: '#61dafb',
  py: '#4B8BBE',
  go: '#00ADD8',
};

const EXT_BG: Record<string, string> = {
  ts: 'rgba(49,120,198,0.12)',
  tsx: 'rgba(97,218,251,0.12)',
  js: 'rgba(240,219,79,0.12)',
  jsx: 'rgba(97,218,251,0.12)',
  py: 'rgba(75,139,190,0.12)',
  go: 'rgba(0,173,216,0.12)',
};

function FileNode({ data, selected }: { data: any; selected?: boolean }) {
  const ext = data.type || '';
  const color = EXT_COLOR[ext] ?? '#a0a0c0';
  const bg = EXT_BG[ext] ?? 'rgba(100,100,160,0.12)';
  const parts = data.label.split('/');
  const name = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');

  return (
    <div
      className="file-node"
      style={{
        background: selected ? 'rgba(79,70,229,0.25)' : bg,
        borderColor: selected ? '#7c6fff' : color,
        boxShadow: selected ? `0 0 0 2px #7c6fff55` : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="node-badge" style={{ background: color, color: '#000' }}>
        {ext.toUpperCase() || '?'}
      </div>
      <div className="node-content">
        <span className="node-name">{name}</span>
        {dir && <span className="node-dir">{dir}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}

export default memo(FileNode);
