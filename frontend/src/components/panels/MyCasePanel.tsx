import { useState, useEffect } from 'react';
import { FileText, MessageSquare, AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { getCallerGuide, type CallerGuide } from '@/services/api';

interface MyCasePanelProps {
  caseId: number;
}

export function MyCasePanel({ caseId }: MyCasePanelProps) {
  const [guide, setGuide] = useState<CallerGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateText, setUpdateText] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const response = await getCallerGuide(caseId);
        if (response.status !== 'processing') {
          setGuide(response);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch guide:', err);
        setLoading(false);
      }
    };

    fetchGuide();
    // Poll every 5 seconds if still loading
    const interval = setInterval(() => {
      if (loading) fetchGuide();
    }, 5000);

    return () => clearInterval(interval);
  }, [caseId, loading]);

  const handleSubmitUpdate = async () => {
    if (!updateText.trim()) return;

    setSubmittingUpdate(true);
    try {
      // TODO: Call API to submit update
      // await submitCaseUpdate(caseId, updateText);

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear input
      setUpdateText('');

      // Show success feedback
      alert('Update submitted successfully!');
    } catch (err) {
      console.error('Failed to submit update:', err);
      alert('Failed to submit update. Please try again.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  return (
    <div className="h-full flex flex-col glass">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          My Help Request
        </h2>
        <p className="text-sm text-gray-400 mt-1">Case #{caseId}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* AI Safety Guide */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            AI Safety Guidance
          </h3>

          {loading ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-3 text-gray-400">
                <Clock className="w-4 h-4 animate-pulse" />
                <span className="text-sm">AI is analyzing your situation...</span>
              </div>
            </div>
          ) : guide ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-300 mb-2">
                    Follow these safety instructions:
                  </p>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {guide.guide_text}
                  </div>
                </div>
              </div>
              {guide.research_results_summary && (
                <div className="mt-3 pt-3 border-t border-blue-500/20">
                  <p className="text-xs text-blue-400 font-medium mb-1">Research Summary</p>
                  <p className="text-xs text-gray-400">{guide.research_results_summary}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-sm text-gray-400">No guidance available yet</p>
            </div>
          )}
        </div>

        {/* Log Update Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-400" />
            Log Situation Update
          </h3>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <p className="text-xs text-gray-400">
              Share any changes in your situation to help responders
            </p>

            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="E.g., 'I've moved to a safer location' or 'More people have joined me'"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              rows={3}
              disabled={submittingUpdate}
            />

            <button
              onClick={handleSubmitUpdate}
              disabled={!updateText.trim() || submittingUpdate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:bg-white/5 border border-green-500/30 disabled:border-white/10 rounded-lg text-sm font-medium text-green-300 disabled:text-gray-500 transition-colors disabled:cursor-not-allowed"
            >
              {submittingUpdate ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Update
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-2">Request Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm text-white">Waiting for responder</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Your location and request details are visible to nearby helpers
          </p>
        </div>
      </div>
    </div>
  );
}
