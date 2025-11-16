import { useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node as FlowNode,
  type Edge as FlowEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Activity, Database, Cpu, Wrench } from 'lucide-react';

interface WorkflowGraphProps {
  runId: string;
  onClose?: () => void;
}

// Custom node component
function CustomNode({ data }: any) {
  const getIcon = () => {
    switch (data.type) {
      case 'agent':
        return <Activity className="w-4 h-4" />;
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'llm':
        return <Cpu className="w-4 h-4" />;
      case 'tool':
        return <Wrench className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getColorClass = () => {
    if (data.status === 'error') return 'border-red-500 bg-red-500/20';
    if (data.status === 'success') return 'border-green-500 bg-green-500/20';
    return 'border-blue-500 bg-blue-500/20';
  };

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${getColorClass()} glass min-w-[180px]`}>
      <div className="flex items-center gap-2 mb-1">
        {getIcon()}
        <div className="text-sm font-bold text-neutral-50">{data.label}</div>
      </div>
      <div className="text-xs text-neutral-400">
        {data.latency_ms?.toFixed(0)}ms
      </div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function WorkflowGraph({ runId, onClose }: WorkflowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflowGraph();
  }, [runId]);

  const fetchWorkflowGraph = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/workflow-graph/${runId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch workflow graph');
      }

      const data = await response.json();

      // Convert to React Flow format
      const flowNodes: FlowNode[] = data.nodes.map((node: any, index: number) => ({
        id: node.id,
        type: 'custom',
        position: {
          x: index === 0 ? 300 : 100 + (index % 3) * 250,
          y: index === 0 ? 50 : 150 + Math.floor((index - 1) / 3) * 120,
        },
        data: {
          label: node.label,
          type: node.type,
          status: node.status,
          latency_ms: node.latency_ms,
          inputs: node.inputs,
          outputs: node.outputs,
        },
      }));

      const flowEdges: FlowEdge[] = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { stroke: '#8B9B7A', strokeWidth: 2 },
        labelStyle: { fill: '#E5E1D8', fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: '#2A2019', fillOpacity: 0.8 },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch workflow graph:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-xl border border-white/10 shadow-xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-50 tracking-tight">
          Workflow Execution Graph
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm glass hover:bg-white/10 rounded-lg transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <div className="h-[500px] bg-neutral-900">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-500">Loading workflow graph...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400">Error: {error}</div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-neutral-900"
          >
            <Background color="#4A4A4A" gap={16} />
            <Controls className="glass border border-white/10" />
          </ReactFlow>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-white/10 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/20"></div>
          <span className="text-neutral-400">Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-500/20"></div>
          <span className="text-neutral-400">Success</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-500/20"></div>
          <span className="text-neutral-400">Error</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-neutral-400">Database Query</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="text-neutral-400">LLM Call</span>
        </div>
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-400" />
          <span className="text-neutral-400">Tool</span>
        </div>
      </div>
    </div>
  );
}
