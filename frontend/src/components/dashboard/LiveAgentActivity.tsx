import { useState, useEffect, useRef } from 'react';
import { PlayCircle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Code, GitBranch } from 'lucide-react';
import { WorkflowGraph } from './WorkflowGraph';

interface AgentAction {
  id: string;
  timestamp: Date;
  agentType: string;
  action: string;
  input: any;
  output: any;
  status: 'running' | 'success' | 'error';
  duration?: number;
  toolName?: string;
}

interface AgentRun {
  runId: string;
  timestamp: Date;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
  actions: AgentAction[];
  totalDuration?: number;
}

export function LiveAgentActivity() {
  // Session-only state - clears on page refresh
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [selectedRunForGraph, setSelectedRunForGraph] = useState<string | null>(null);

  useEffect(() => {
    // Fetch real agent runs from backend
    fetchAgentRuns();

    // Poll for new runs every 10 seconds
    const interval = setInterval(fetchAgentRuns, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgentRuns = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/agent-runs?limit=10');
      const data = await response.json();

      if (data.runs && data.runs.length > 0) {
        setAgentRuns(data.runs.map((run: any) => ({
          ...run,
          timestamp: new Date(run.timestamp),
          actions: run.actions.map((action: any) => ({
            ...action,
            timestamp: new Date(action.timestamp),
          })),
        })));
      } else {
        // Fallback to mock data if no real runs available
        loadMockRun();
      }
    } catch (error) {
      console.error('Failed to fetch agent runs:', error);
      // Load mock data on error
      loadMockRun();
    }
  };

  const loadMockRun = () => {
    const mockRun: AgentRun = {
      runId: `run-${Date.now()}`,
      timestamp: new Date(),
      agentType: 'InputProcessingAgent',
      status: 'completed',
      totalDuration: 2.4,
      actions: [
        {
          id: 'action-1',
          timestamp: new Date(Date.now() - 2400),
          agentType: 'InputProcessingAgent',
          action: 'analyze_emergency_description',
          input: {
            description: 'Fire in apartment, trapped on 3rd floor, 2 people',
            location: { lat: 51.5074, lng: -0.1278 },
          },
          output: {
            emergency_type: 'fire',
            urgency: 'critical',
            people_count: 2,
            floor_number: 3,
            mobility_status: 'trapped',
          },
          status: 'success',
          duration: 0.8,
          toolName: 'analyze_text',
        },
        {
          id: 'action-2',
          timestamp: new Date(Date.now() - 1600),
          agentType: 'InputProcessingAgent',
          action: 'create_case',
          input: {
            emergency_type: 'fire',
            urgency: 'critical',
            people_count: 2,
          },
          output: {
            case_id: 123,
            status: 'created',
          },
          status: 'success',
          duration: 0.6,
          toolName: 'database_write',
        },
        {
          id: 'action-3',
          timestamp: new Date(Date.now() - 1000),
          agentType: 'InputProcessingAgent',
          action: 'generate_caller_guide',
          input: {
            case_id: 123,
            emergency_type: 'fire',
          },
          output: {
            guide: [
              'Stay low to avoid smoke inhalation',
              'Cover door gaps with wet towels',
              'Signal from window if possible',
            ],
          },
          status: 'success',
          duration: 1.0,
          toolName: 'llm_generate',
        },
      ],
    };

    // Add mock run and expand it
    if (agentRuns.length === 0) {
      setAgentRuns([mockRun]);
      setExpandedRuns(new Set([mockRun.runId]));
    }
  };

  const toggleRunExpansion = (runId: string) => {
    setExpandedRuns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(runId)) {
        newSet.delete(runId);
      } else {
        newSet.add(runId);
      }
      return newSet;
    });
  };

  const toggleActionExpansion = (actionId: string) => {
    setExpandedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="w-5 h-5 text-blue-400 animate-pulse" />;
      case 'success':
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-neutral-400" />;
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-neutral-50 tracking-tight">Live Agent Activity</h2>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-xs font-bold text-green-300">Live</span>
        </div>
      </div>

      {agentRuns.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-neutral-500">
          <p className="font-medium">Waiting for agent activity...</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {agentRuns.map(run => (
            <div
              key={run.runId}
              className="border border-white/10 rounded-lg bg-gradient-to-br from-neutral-900/50 to-neutral-800/50 overflow-hidden"
            >
              {/* Run Header */}
              <button
                onClick={() => toggleRunExpansion(run.runId)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(run.status)}
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-50">{run.agentType}</p>
                    <p className="text-xs text-neutral-400 font-medium">
                      {formatTimestamp(run.timestamp)}
                      {run.totalDuration && ` • ${run.totalDuration.toFixed(2)}s`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRunForGraph(run.runId);
                    }}
                    className="px-3 py-1 text-xs glass hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1 font-semibold"
                    title="View workflow graph"
                  >
                    <GitBranch className="w-3 h-3" />
                    Workflow
                  </button>
                  <span className="text-xs text-neutral-500 font-semibold">{run.actions.length} actions</span>
                  {expandedRuns.has(run.runId) ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </button>

              {/* Actions List */}
              {expandedRuns.has(run.runId) && (
                <div className="px-4 pb-4 space-y-2">
                  {run.actions.map((action, index) => (
                    <div
                      key={action.id}
                      className="border-l-2 border-primary/30 pl-4 ml-2"
                    >
                      <button
                        onClick={() => toggleActionExpansion(action.id)}
                        className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(action.status)}
                            <p className="text-sm font-bold text-neutral-200">{action.action}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {action.toolName && (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-primary/20 text-primary-light border border-primary/30">
                                {action.toolName}
                              </span>
                            )}
                            {action.duration && (
                              <span className="text-xs text-neutral-500 font-medium">{action.duration}s</span>
                            )}
                            {expandedActions.has(action.id) ? (
                              <ChevronUp className="w-3 h-3 text-neutral-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-neutral-400" />
                            )}
                          </div>
                        </div>

                        {expandedActions.has(action.id) && (
                          <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                            {/* Input */}
                            <div className="rounded-lg bg-secondary/10 border border-secondary/30 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Code className="w-3 h-3 text-secondary-light" />
                                <p className="text-xs font-bold text-secondary-light">Input</p>
                              </div>
                              <pre className="text-xs text-neutral-300 font-mono overflow-x-auto">
                                {JSON.stringify(action.input, null, 2)}
                              </pre>
                            </div>

                            {/* Output */}
                            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Code className="w-3 h-3 text-primary-light" />
                                <p className="text-xs font-bold text-primary-light">Output</p>
                              </div>
                              <pre className="text-xs text-neutral-300 font-mono overflow-x-auto">
                                {JSON.stringify(action.output, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Workflow Graph Modal */}
      {selectedRunForGraph && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/70 backdrop-blur-md">
          <WorkflowGraph runId={selectedRunForGraph} onClose={() => setSelectedRunForGraph(null)} />
        </div>
      )}
    </div>
  );
}
