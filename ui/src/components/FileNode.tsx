import { Handle, Position } from '@xyflow/react';
import { FileCode2, FolderGit2, Hash, Landmark } from 'lucide-react';
import { memo } from 'react';

const ROLE_BORDER: Record<string, string> = {
  database: '#111111',
  orm: '#444444',
  api: '#555555',
  service: '#666666',
  frontend: '#777777',
  shared: '#666666',
  config: '#888888',
  infra: '#222222',
  tests: '#555555',
  docs: '#999999',
  script: '#333333',
  unknown: '#666666',
};

const ROLE_BG: Record<string, string> = {
  database: 'rgba(255,255,255,0.96)',
  orm: 'rgba(245,245,245,0.96)',
  api: 'rgba(240,240,240,0.96)',
  service: 'rgba(238,238,238,0.96)',
  frontend: 'rgba(234,234,234,0.96)',
  shared: 'rgba(236,236,236,0.96)',
  config: 'rgba(230,230,230,0.96)',
  infra: 'rgba(250,250,250,0.96)',
  tests: 'rgba(242,242,242,0.96)',
  docs: 'rgba(248,248,248,0.96)',
  script: 'rgba(235,235,235,0.96)',
  unknown: 'rgba(244,244,244,0.96)',
};

function FileNode({ data, selected }: { data: any; selected?: boolean }) {
  const role = data.role || 'unknown';
  const theme = data.theme || 'dark';
  const borderColor = ROLE_BORDER[role] ?? '#666666';
  const bg = theme === 'dark' ? 'rgba(17,17,17,0.96)' : (ROLE_BG[role] ?? 'rgba(244,244,244,0.96)');
  const textColor = theme === 'dark' ? '#f5f5f5' : '#111111';
  const mutedColor = theme === 'dark' ? '#b5b5b5' : '#555555';
  const parts = String(data.label || '').split('/');
  const name = parts[parts.length - 1] || data.label;
  const dir = parts.slice(0, -1).join('/');
  const isArchitectureNode = data.language === 'architecture';
  const moduleLabel = data.moduleLabel || (data.directory && data.directory !== '.' ? data.directory : 'Core');
  const componentLabel = data.componentLabel || name;
  const roleLabel = role === 'unknown' ? 'CORE' : String(role).toUpperCase();
  const secondaryLabel = isArchitectureNode ? componentLabel : name;
  const tertiaryLabel = isArchitectureNode ? moduleLabel : dir;

  return (
    <div
      className="file-node"
      style={{
        background: selected ? (theme === 'dark' ? '#000000' : '#ffffff') : bg,
        borderColor: selected ? (theme === 'dark' ? '#ffffff' : '#000000') : borderColor,
        color: textColor,
        boxShadow: selected ? `0 0 0 1px ${theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'}, 0 18px 40px rgba(0,0,0,0.18)` : '0 14px 32px rgba(0,0,0,0.12)',
      }}
    >
      <Handle type="target" position={Position.Left} className="handle handle-left" />
      <div className="node-icon" style={{ borderColor, color: textColor, background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <FileCode2 size={16} />
      </div>
      <div className="node-content">
        <div className="node-name" title={isArchitectureNode ? `${moduleLabel} ${componentLabel}` : data.label}>{secondaryLabel}</div>
        <div className="node-meta-row">
          <span className="node-ext" style={{ color: mutedColor }}>{roleLabel}</span>
          {typeof data.imports === 'number' && (
            <span className="node-connection-count">
              <Hash size={11} />
              {data.imports}
            </span>
          )}
        </div>
        {tertiaryLabel && <div className="node-dir" title={tertiaryLabel}><FolderGit2 size={11} />{tertiaryLabel}</div>}
      </div>
      <div className="node-pill" style={{ borderColor, color: textColor }}>
        <Landmark size={11} />
      </div>
      <Handle type="source" position={Position.Right} className="handle handle-right" />
    </div>
  );
}

export default memo(FileNode);
