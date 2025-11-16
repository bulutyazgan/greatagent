import { useState } from 'react';
import { X, MapPin, Users, AlertTriangle, Clock, MessageSquare, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { HelpRequest } from '@/types';

interface CaseDetailsDialogProps {
  helpRequest: HelpRequest;
  onClose: () => void;
  onClaim: (caseId: string) => Promise<void>;
}

export function CaseDetailsDialog({ helpRequest, onClose, onClaim }: CaseDetailsDialogProps) {
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await onClaim(helpRequest.id);
      onClose();
    } catch (error) {
      console.error('Failed to claim case:', error);
    } finally {
      setClaiming(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default:
        return 'text-green-400 bg-green-500/20 border-green-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Help Request Details</h2>
            <p className="text-sm text-gray-400 mt-1">Case #{helpRequest.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Urgency Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getUrgencyColor(helpRequest.urgency)}`}>
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold uppercase text-sm">{helpRequest.urgency} URGENCY</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>{new Date(helpRequest.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Situation Description
            </h3>
            <p className="text-gray-300">{helpRequest.description}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">Address</span>
              </div>
              <p className="text-white text-sm">
                {helpRequest.location.lat.toFixed(4)}, {helpRequest.location.lng.toFixed(4)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click on map to view exact location
              </p>
            </div>

            {/* People Count */}
            {helpRequest.peopleCount > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">People Affected</span>
                </div>
                <p className="text-white text-lg font-semibold">{helpRequest.peopleCount}</p>
              </div>
            )}
          </div>

          {/* Vulnerability Factors */}
          {helpRequest.vulnerabilityFactors && helpRequest.vulnerabilityFactors.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-orange-300 mb-2">Vulnerability Factors</h3>
              <div className="flex flex-wrap gap-2">
                {helpRequest.vulnerabilityFactors.map((factor, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-xs text-orange-200"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mobility Status */}
          {helpRequest.mobilityStatus && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-1">Mobility Status</h3>
              <p className="text-gray-300 capitalize">{helpRequest.mobilityStatus}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={handleClaim}
              disabled={claiming || helpRequest.status !== 'pending'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-gray-500/10 border border-green-500/30 disabled:border-gray-500/20 rounded-lg font-semibold text-green-300 disabled:text-gray-500 transition-colors disabled:cursor-not-allowed"
            >
              {claiming ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Claiming...
                </>
              ) : helpRequest.status === 'pending' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  I'm Responding to This Case
                </>
              ) : (
                <>Already Claimed</>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 glass hover:bg-white/10 rounded-lg font-medium text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
