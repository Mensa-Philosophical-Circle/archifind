import { BookOpen, Code2, File, GitBranch, Hash, Layers3, X } from 'lucide-react';
import type { NodeData } from '../types';

const ROLE_LABELS: Record<string, string> = {
  database: 'Database',
  orm: 'ORM',
  api: 'API',
  service: 'Service',
  frontend: 'Frontend',
  shared: 'Shared',
  config: 'Config',
  infra: 'Infra',
  tests: 'Tests',
  docs: 'Docs',
  script: 'Script',
  unknown: 'Unclassified',
};

interface Props {
  node: NodeData;
  onClose: () => void;
}

export default function DetailPanel({ node, onClose }: Props) {
  const role = node.data.role || 'unknown';
  const badge = ROLE_LABELS[role] ?? role.toUpperCase();
  const parts = node.id.split('/');
  const fileName = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');
  const isArchNode = node.id.startsWith('arch:');
  const componentLabel = node.data.componentLabel || (isArchNode ? 'Component' : 'File');
  const moduleLabel = node.data.moduleLabel || 'Module';

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-title">
          <File size={14} />
          <span>Details</span>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close details">
          <X size={14} />
        </button>
      </div>

      {/* Module classification (AI-generated) */}
      {moduleLabel && (
        <div className="detail-ai-section">
          <div className="detail-ai-label">Module (AI-classified)</div>
          <div className="detail-ai-value">{moduleLabel}</div>
        </div>
      )}

      {/* Component classification (AI-generated) */}
      {componentLabel && (
        <div className="detail-ai-section">
          <div className="detail-ai-label">Component Type (AI-classified)</div>
          <div className="detail-ai-value">{componentLabel}</div>
        </div>
      )}

      <div className="detail-badge">
        <Code2 size={12} />
        <span>{badge}</span>
      </div>

      <div className="detail-filename">{fileName}</div>

      <div className="detail-role-line">
        <Layers3 size={12} />
        <span>{node.data.layer}</span>
      </div>

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

      {node.data.symbols?.length ? (
        <div className="detail-symbols">
          <div className="detail-symbols-title">
            <BookOpen size={12} />
            <span>Exports</span>
          </div>
          <div className="detail-symbol-list">
            {node.data.symbols.slice(0, 8).map((symbol) => (
              <span key={symbol} className="detail-symbol-pill">
                {symbol}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {node.data.files?.length ? (
        <div className="detail-symbols">
          <div className="detail-symbols-title">
            <BookOpen size={12} />
            <span>Included Files</span>
          </div>
          <div className="detail-symbol-list">
            {node.data.files.slice(0, 8).map((file) => (
              <span key={file} className="detail-symbol-pill">
                {file.split('/').pop()}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="detail-path-full">{node.id}</div>
    </div>
  );
}
