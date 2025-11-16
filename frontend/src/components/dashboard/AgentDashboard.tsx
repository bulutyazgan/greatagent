import { useState, useEffect } from 'react';
import { Activity, Zap, DollarSign, Leaf, TrendingUp } from 'lucide-react';
import { ToolUsageChart } from './ToolUsageChart';
import { LiveAgentActivity } from './LiveAgentActivity';
import { LatencyBreakdown } from './LatencyBreakdown';
import { ToolStatistics } from './ToolStatistics';

interface Metrics {
  totalTokens: number;
  avgLatency: number;
  totalCost: number;
  carbonFootprint: number;
  successRate: number;
  totalRuns: number;
}

export function AgentDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalTokens: 0,
    avgLatency: 0,
    totalCost: 0,
    carbonFootprint: 0,
    successRate: 0,
    totalRuns: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    // Poll metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/metrics?hours=24');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Metrics data received:', data); // Debug logging

      setMetrics({
        totalTokens: data.total_tokens || 0,
        avgLatency: data.avg_latency_seconds || 0,
        totalCost: data.cost_estimate_usd || 0,
        carbonFootprint: data.carbon_footprint_grams || 0,
        successRate: data.success_rate || 0,
        totalRuns: data.total_runs || 0,
      });
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background-primary">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-neutral-900 to-neutral-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-primary-light" />
            <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">Agent Dashboard</h1>
          </div>
          <p className="text-neutral-400 font-medium">
            Real-time monitoring of AI agent performance and activity
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Tokens */}
          <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
                <Zap className="w-6 h-6 text-primary-light" />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>Live</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-400 font-semibold">Total Tokens</p>
              <p className="text-3xl font-bold text-neutral-50 tracking-tight">
                {isLoading ? '...' : metrics.totalTokens.toLocaleString()}
              </p>
              <p className="text-xs text-neutral-500 font-medium">Last 24 hours</p>
            </div>
          </div>

          {/* Average Latency */}
          <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-secondary/20 border border-secondary/30">
                <Activity className="w-6 h-6 text-secondary-light" />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>Live</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-400 font-semibold">Avg Latency</p>
              <p className="text-3xl font-bold text-neutral-50 tracking-tight">
                {isLoading ? '...' : `${metrics.avgLatency.toFixed(2)}s`}
              </p>
              <p className="text-xs text-neutral-500 font-medium">Per request</p>
            </div>
          </div>

          {/* Total Cost */}
          <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-alert/20 border border-alert/30">
                <DollarSign className="w-6 h-6 text-alert-light" />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>Live</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-400 font-semibold">Total Cost</p>
              <p className="text-3xl font-bold text-neutral-50 tracking-tight">
                {isLoading ? '...' : `$${metrics.totalCost.toFixed(4)}`}
              </p>
              <p className="text-xs text-neutral-500 font-medium">API usage</p>
            </div>
          </div>

          {/* Carbon Footprint */}
          <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                <Leaf className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>Live</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-400 font-semibold">Carbon Footprint</p>
              <p className="text-3xl font-bold text-neutral-50 tracking-tight">
                {isLoading ? '...' : `${metrics.carbonFootprint.toFixed(2)}g`}
              </p>
              <p className="text-xs text-neutral-500 font-medium">CO₂ equivalent</p>
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
          <h2 className="text-xl font-bold text-neutral-50 mb-4 tracking-tight">Performance Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-neutral-400 font-semibold mb-2">Total Requests</p>
              <p className="text-2xl font-bold text-neutral-50">
                {isLoading ? '...' : metrics.totalRuns.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-400 font-semibold mb-2">Success Rate</p>
              <p className="text-2xl font-bold text-neutral-50">
                {isLoading ? '...' : `${(metrics.successRate * 100).toFixed(1)}%`}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-400 font-semibold mb-2">Cost per Request</p>
              <p className="text-2xl font-bold text-neutral-50">
                {isLoading ? '...' : `$${(metrics.totalCost / Math.max(metrics.totalRuns, 1)).toFixed(6)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Latency Breakdown Section */}
        <div>
          <h2 className="text-2xl font-bold text-neutral-50 mb-4 tracking-tight">Performance Breakdown</h2>
          <LatencyBreakdown />
        </div>

        {/* Tool Usage Graphs */}
        <div>
          <h2 className="text-2xl font-bold text-neutral-50 mb-4 tracking-tight">Tool Usage Analytics</h2>
          <ToolUsageChart />
        </div>

        {/* Tool Statistics */}
        <ToolStatistics />

        {/* Live Agent Activity Feed */}
        <LiveAgentActivity />
      </div>
    </div>
  );
}
