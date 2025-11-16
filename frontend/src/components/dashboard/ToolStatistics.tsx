import { useEffect, useState } from 'react';
import { Wrench, TrendingUp, Clock, Hash } from 'lucide-react';

interface ToolStats {
  count: number;
  avg_time_ms: number;
  total_time_ms: number;
}

interface DetailedMetrics {
  tool_statistics: { [key: string]: ToolStats };
}

export function ToolStatistics() {
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
      console.error('Failed to fetch tool statistics:', error);
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
        <h2 className="text-xl font-bold text-neutral-50 mb-4 tracking-tight">Tool Statistics</h2>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading tool statistics...</div>
        </div>
      </div>
    );
  }

  // Sort tools by total execution time
  const sortedTools = Object.entries(metrics.tool_statistics).sort(
    ([, a], [, b]) => b.total_time_ms - a.total_time_ms
  );

  return (
    <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
      <h2 className="text-xl font-bold text-neutral-50 mb-4 tracking-tight flex items-center gap-2">
        <Wrench className="w-6 h-6 text-primary-light" />
        Tool Performance Statistics
      </h2>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {sortedTools.map(([toolName, stats]) => {
          const maxTime = sortedTools[0][1].total_time_ms;
          const percentage = (stats.total_time_ms / maxTime) * 100;

          return (
            <div
              key={toolName}
              className="border border-white/10 rounded-lg p-4 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-neutral-200 mb-1">{toolName}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      <span>{stats.count} calls</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{stats.avg_time_ms.toFixed(1)}ms avg</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{stats.total_time_ms.toFixed(0)}ms total</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-neutral-50">
                    {stats.avg_time_ms.toFixed(0)}
                    <span className="text-xs text-neutral-500 ml-1">ms</span>
                  </div>
                </div>
              </div>

              {/* Performance bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-secondary to-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs font-semibold text-neutral-500 min-w-[45px] text-right">
                  {percentage.toFixed(0)}%
                </div>
              </div>

              {/* Performance indicator */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  {stats.avg_time_ms < 100 ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-green-400 font-semibold">Fast</span>
                    </>
                  ) : stats.avg_time_ms < 500 ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                      <span className="text-yellow-400 font-semibold">Moderate</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      <span className="text-orange-400 font-semibold">Slow</span>
                    </>
                  )}
                </div>

                <div className="text-neutral-500">
                  {((stats.total_time_ms / stats.count) * stats.count).toFixed(0)}ms cumulative
                </div>
              </div>
            </div>
          );
        })}

        {sortedTools.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            No tool statistics available yet
          </div>
        )}
      </div>
    </div>
  );
}
