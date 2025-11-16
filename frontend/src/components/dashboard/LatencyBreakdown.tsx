import { useEffect, useState } from 'react';
import { Database, Cpu, Clock, TrendingDown } from 'lucide-react';

interface RunBreakdown {
  run_id: string;
  name: string;
  total_latency_ms: number;
  db_time_ms: number;
  llm_time_ms: number;
  other_time_ms: number;
  db_percentage: number;
  llm_percentage: number;
  timestamp: string;
}

interface DetailedMetrics {
  time_window_hours: number;
  total_runs: number;
  run_breakdowns: RunBreakdown[];
  database_queries: {
    total_count: number;
    avg_latency_ms: number;
  };
  llm_calls: {
    total_count: number;
    avg_latency_ms: number;
  };
}

export function LatencyBreakdown() {
  const [metrics, setMetrics] = useState<DetailedMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/metrics/detailed?hours=24');
      const data = await response.json();
      setMetrics(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch detailed metrics:', error);
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
        <h2 className="text-xl font-bold text-neutral-50 mb-4 tracking-tight">Latency Breakdown</h2>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading detailed metrics...</div>
        </div>
      </div>
    );
  }

  // Calculate averages
  const avgDbTime = metrics.run_breakdowns.length > 0
    ? metrics.run_breakdowns.reduce((sum, r) => sum + r.db_time_ms, 0) / metrics.run_breakdowns.length
    : 0;

  const avgLlmTime = metrics.run_breakdowns.length > 0
    ? metrics.run_breakdowns.reduce((sum, r) => sum + r.llm_time_ms, 0) / metrics.run_breakdowns.length
    : 0;

  const avgOtherTime = metrics.run_breakdowns.length > 0
    ? metrics.run_breakdowns.reduce((sum, r) => sum + r.other_time_ms, 0) / metrics.run_breakdowns.length
    : 0;

  const avgTotalTime = avgDbTime + avgLlmTime + avgOtherTime;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Time */}
        <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-xs text-neutral-500 font-semibold">
              {metrics.database_queries.total_count} queries
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-semibold mb-2">Avg DB Time</p>
            <p className="text-3xl font-bold text-neutral-50">{avgDbTime.toFixed(0)}ms</p>
            <p className="text-xs text-neutral-500 mt-1">
              {((avgDbTime / avgTotalTime) * 100).toFixed(1)}% of total
            </p>
          </div>
        </div>

        {/* LLM Time */}
        <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <Cpu className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-xs text-neutral-500 font-semibold">
              {metrics.llm_calls.total_count} calls
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-semibold mb-2">Avg LLM Time</p>
            <p className="text-3xl font-bold text-neutral-50">{avgLlmTime.toFixed(0)}ms</p>
            <p className="text-xs text-neutral-500 mt-1">
              {((avgLlmTime / avgTotalTime) * 100).toFixed(1)}% of total
            </p>
          </div>
        </div>

        {/* Other Time */}
        <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div className="text-xs text-neutral-500 font-semibold">
              overhead
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-semibold mb-2">Other Time</p>
            <p className="text-3xl font-bold text-neutral-50">{avgOtherTime.toFixed(0)}ms</p>
            <p className="text-xs text-neutral-500 mt-1">
              {((avgOtherTime / avgTotalTime) * 100).toFixed(1)}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Recent Runs Timeline */}
      <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold text-neutral-50 mb-4 tracking-tight flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Recent Runs Latency Breakdown
        </h3>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {metrics.run_breakdowns.slice().reverse().map((run) => (
            <div key={run.run_id} className="border border-white/10 rounded-lg p-4 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-neutral-200">{run.name}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(run.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-neutral-300">
                    {run.total_latency_ms.toFixed(0)}ms
                  </p>
                  <p className="text-xs text-neutral-500">total</p>
                </div>
              </div>

              {/* Stacked Bar */}
              <div className="flex w-full h-6 rounded-full overflow-hidden bg-neutral-800">
                {run.db_time_ms > 0 && (
                  <div
                    className="bg-blue-500 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${run.db_percentage}%` }}
                    title={`DB: ${run.db_time_ms.toFixed(0)}ms`}
                  >
                    {run.db_percentage > 15 && `${run.db_percentage.toFixed(0)}%`}
                  </div>
                )}
                {run.llm_time_ms > 0 && (
                  <div
                    className="bg-purple-500 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${run.llm_percentage}%` }}
                    title={`LLM: ${run.llm_time_ms.toFixed(0)}ms`}
                  >
                    {run.llm_percentage > 15 && `${run.llm_percentage.toFixed(0)}%`}
                  </div>
                )}
                {run.other_time_ms > 0 && (
                  <div
                    className="bg-orange-500 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${(100 - run.db_percentage - run.llm_percentage)}%` }}
                    title={`Other: ${run.other_time_ms.toFixed(0)}ms`}
                  >
                    {(100 - run.db_percentage - run.llm_percentage) > 15 &&
                      `${(100 - run.db_percentage - run.llm_percentage).toFixed(0)}%`}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span className="text-neutral-400">DB: {run.db_time_ms.toFixed(0)}ms</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-500"></div>
                  <span className="text-neutral-400">LLM: {run.llm_time_ms.toFixed(0)}ms</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500"></div>
                  <span className="text-neutral-400">Other: {run.other_time_ms.toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
