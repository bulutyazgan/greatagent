import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ToolUsageChartProps {
  data?: {
    [toolName: string]: number;
  };
}

export function ToolUsageChart({ data }: ToolUsageChartProps) {
  const [toolData, setToolData] = useState<{[key: string]: number}>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchToolUsage();
    // Refresh every 60 seconds
    const interval = setInterval(fetchToolUsage, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchToolUsage = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/tool-usage?hours=24');
      const result = await response.json();

      if (result.tool_usage && Object.keys(result.tool_usage).length > 0) {
        setToolData(result.tool_usage);
      } else {
        // Fallback to mock data if no real data available
        setToolData({
          'create_case': 45,
          'get_nearby_cases': 32,
          'create_assignment': 28,
          'get_caller_guide': 41,
          'get_helper_guide': 26,
          'create_message': 38,
          'get_location': 52,
        });
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch tool usage:', error);
      // Use mock data on error
      setToolData({
        'create_case': 45,
        'get_nearby_cases': 32,
        'create_assignment': 28,
        'get_caller_guide': 41,
        'get_helper_guide': 26,
        'create_message': 38,
        'get_location': 52,
      });
      setIsLoading(false);
    }
  };

  const toolNames = Object.keys(toolData);
  const toolCounts = Object.values(toolData);

  const barChartData = {
    labels: toolNames.map(name => name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    datasets: [
      {
        label: 'Tool Calls',
        data: toolCounts,
        backgroundColor: [
          'rgba(166, 124, 82, 0.8)',   // primary
          'rgba(139, 155, 122, 0.8)',  // secondary
          'rgba(193, 122, 91, 0.8)',   // alert
          'rgba(166, 124, 82, 0.6)',
          'rgba(139, 155, 122, 0.6)',
          'rgba(193, 122, 91, 0.6)',
          'rgba(166, 124, 82, 0.4)',
        ],
        borderColor: [
          '#A67C52',
          '#8B9B7A',
          '#C17A5B',
          '#A67C52',
          '#8B9B7A',
          '#C17A5B',
          '#A67C52',
        ],
        borderWidth: 2,
      },
    ],
  };

  const doughnutData = {
    labels: toolNames.map(name => name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    datasets: [
      {
        label: 'Tool Distribution',
        data: toolCounts,
        backgroundColor: [
          'rgba(166, 124, 82, 0.8)',
          'rgba(139, 155, 122, 0.8)',
          'rgba(193, 122, 91, 0.8)',
          'rgba(166, 124, 82, 0.6)',
          'rgba(139, 155, 122, 0.6)',
          'rgba(193, 122, 91, 0.6)',
          'rgba(166, 124, 82, 0.4)',
        ],
        borderColor: [
          '#A67C52',
          '#8B9B7A',
          '#C17A5B',
          '#A67C52',
          '#8B9B7A',
          '#C17A5B',
          '#A67C52',
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#E5E1D8',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(42, 32, 25, 0.95)',
        titleColor: '#E5E1D8',
        bodyColor: '#B8AEA0',
        borderColor: 'rgba(166, 124, 82, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#B8AEA0',
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#B8AEA0',
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          color: '#E5E1D8',
          font: {
            size: 11,
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(42, 32, 25, 0.95)',
        titleColor: '#E5E1D8',
        bodyColor: '#B8AEA0',
        borderColor: 'rgba(166, 124, 82, 0.5)',
        borderWidth: 1,
        padding: 12,
      },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart */}
      <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold text-neutral-50 mb-4 tracking-tight">Tool Call Frequency</h3>
        <div className="h-80">
          <Bar data={barChartData} options={chartOptions} />
        </div>
      </div>

      {/* Doughnut Chart */}
      <div className="glass rounded-xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold text-neutral-50 mb-4 tracking-tight">Tool Distribution</h3>
        <div className="h-80">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>
    </div>
  );
}
