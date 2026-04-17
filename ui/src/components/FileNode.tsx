import { Handle, Position } from '@xyflow/react';
import { FileCode2, FolderGit2, Hash, Landmark } from 'lucide-react';
import { memo } from 'react';

const EXT_COLOR: Record<string, string> = {
  ts: '#4f8cff',
  tsx: '#6fd5ff',
  js: '#f5c542',
  jsx: '#f5c542',
  py: '#61b5ff',
  go: '#3fd3d0',
};

const EXT_BG: Record<string, string> = {
  ts: 'rgba(79,140,255,0.10)',
  tsx: 'rgba(111,213,255,0.10)',
  js: 'rgba(245,197,66,0.10)',
  jsx: 'rgba(245,197,66,0.10)',
  py: 'rgba(97,181,255,0.10)',
  go: 'rgba(63,211,208,0.10)',
};

function FileNode({ data, selected }: { data: any; selected?: boolean }) {
  const ext = data.ext || '';
  const color = EXT_COLOR[ext] ?? '#8ea2c7';
  const bg = EXT_BG[ext] ?? 'rgba(142,162,199,0.10)';
  const parts = data.label.split('/');
  const name = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');

  return (
    <div
      className="file-node"
      style={{
        background: selected ? 'rgba(15,23,42,0.98)' : bg,
        borderColor: selected ? '#f8fafc' : color,
        boxShadow: selected ? '0 0 0 1px rgba(248,250,252,0.6), 0 18px 40px rgba(2,6,23,0.45)' : '0 14px 32px rgba(2,6,23,0.18)',
      }}
    >
      <Handle type="target" position={Position.Left} className="handle handle-left" />
      <div className="node-icon" style={{ borderColor: color, color }}>
        <FileCode2 size={16} />
      </div>
      <div className="node-content">
        <div className="node-name" title={data.label}>{name}</div>
        <div className="node-meta-row">
          <span className="node-ext" style={{ color }}>{ext.toUpperCase() || 'FILE'}</span>
          {typeof data.imports === 'number' && (
            <span className="node-connection-count">
              <Hash size={11} />
              {data.imports}
            </span>
          )}
        </div>
        {dir && <div className="node-dir" title={dir}><FolderGit2 size={11} />{dir}</div>}
      </div>
      <div className="node-pill" style={{ borderColor: color, color }}>
        <Landmark size={11} />
      </div>
      <Handle type="source" position={Position.Right} className="handle handle-right" />
    </div>
  );
}

export default memo(FileNode);
