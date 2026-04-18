import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Cpu } from 'lucide-react';

const getIcon = (type: string) => {
  switch (type) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return <FileCode size={16} className="text-blue-500" />;
    case 'py':
      return <FileType size={16} className="text-yellow-500" />;
    case 'go':
      return <Cpu size={16} className="text-cyan-500" />;
    default:
      return <FileType size={16} />;
  }
};

export const SchematicNode = ({ data, selected }: any) => {
  return (
    <div className={`schematic-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <div className="node-icon">{getIcon(data.type)}</div>
      <div className="node-label" title={data.label}>
        {data.label.split('/').pop()}
      </div>
      <div className="type-badge">{data.type}</div>
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
};
