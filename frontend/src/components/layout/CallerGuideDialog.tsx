import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { getCallerGuide, type CallerGuide } from '@/services/api';

interface CallerGuideDialogProps {
  caseId: number;
  onClose: () => void;
}

export function CallerGuideDialog({ caseId, onClose }: CallerGuideDialogProps) {
  const [guide, setGuide] = useState<CallerGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchGuide = async () => {
      try {
        const response = await getCallerGuide(caseId);

        if (!isMounted) return;

        if (response.status === 'processing') {
          // Still processing, keep polling
          setPollCount(prev => prev + 1);
        } else if (response.guide_text) {
          // Guide is ready
          setGuide(response);
          setLoading(false);
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to fetch caller guide:', err);
        setError('Failed to load safety guidance');
        setLoading(false);
        if (interval) clearInterval(interval);
      }
    };

    // Initial fetch
    fetchGuide();

    // Poll every 2 seconds for up to 30 seconds
    interval = setInterval(() => {
      if (pollCount >= 15) {
        setError('AI is taking longer than expected. Please refresh to check again.');
        setLoading(false);
        if (interval) clearInterval(interval);
      } else {
        fetchGuide();
      }
    }, 2000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [caseId]); // Removed pollCount from dependencies to prevent infinite loop

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" />
              Hero Agent Recommendations
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Safety instructions for your situation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
              <p className="text-white font-medium mb-2">
                Hero Agent is analyzing your situation...
              </p>
              <p className="text-gray-400 text-sm text-center max-w-md">
                Hero Agent is generating personalized safety guidance based on your location and description.
                This usually takes 5-10 seconds.
              </p>
              <div className="mt-4 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-white font-medium mb-2">Unable to load guidance</p>
              <p className="text-gray-400 text-sm text-center max-w-md">
                {error}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 glass hover:bg-white/10 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          ) : guide ? (
            <div className="space-y-6">
              {/* Success header */}
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Safety guidance generated successfully</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Follow these instructions while waiting for help
                  </p>
                </div>
              </div>

              {/* Guide text */}
              <div className="prose prose-invert max-w-none">
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    What to do right now:
                  </h3>
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {guide.guide_text}
                  </div>
                </div>
              </div>

              {/* Research info if available */}
              {guide.research_results_summary && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-sm text-blue-300 font-medium mb-2">
                    AI Research Summary
                  </p>
                  <p className="text-sm text-gray-400">
                    {guide.research_results_summary}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Generated by AI • Case #{caseId}
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
