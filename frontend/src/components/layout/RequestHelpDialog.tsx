import { useState } from 'react';
import type { DisasterInfo, Location } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Loader2
} from 'lucide-react';
import { createCase } from '@/services/api';
import { toast } from 'sonner';

interface RequestHelpDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess?: (caseId: number) => void;
  userLocation: Location | null;
  disaster: DisasterInfo;
}

interface FormData {
  description: string;
}

export function RequestHelpDialog({
  open,
  onClose,
  onSubmitSuccess,
  userLocation,
  disaster
}: RequestHelpDialogProps) {
  console.log('📋 RequestHelpDialog rendered with open =', open);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    description: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Please describe your problem';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Please provide more details (at least 10 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Get user ID from localStorage
      const userId = localStorage.getItem('beacon_user_id');

      if (!userId) {
        throw new Error('User not registered. Please refresh and try again.');
      }

      // Create case via API using userLocation from props
      const lat = userLocation?.lat || 51.5074; // Fallback to London
      const lng = userLocation?.lng || -0.1278;

      const response = await createCase({
        user_id: userId,
        latitude: lat,
        longitude: lng,
        raw_problem_description: formData.description,
      });

      console.log('Case created:', response);

      // Store case ID for tracking
      localStorage.setItem('last_case_id', response.case_id.toString());

      // Reset form
      setFormData({
        description: '',
      });
      setErrors({});

      onClose();

      // Trigger refresh callback with case_id
      if (onSubmitSuccess) {
        onSubmitSuccess(response.case_id);
      }

    } catch (error) {
      console.error('Failed to submit help request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">What's Your Emergency?</DialogTitle>
          <DialogDescription className="text-base">
            Describe your situation and our AI will analyze it to connect you with the right help.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Description - ONLY FIELD */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-lg font-semibold">Describe Your Problem *</Label>
            <Textarea
              id="description"
              placeholder="Please tell us what's happening, where you are, and what help you need..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={submitting}
              rows={8}
              className="resize-none text-base"
              autoFocus
            />
            {errors.description && (
              <p className="text-sm text-accent-red">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.description.length} characters (minimum 10 required)
            </p>
          </div>

          {/* Emergency Notice */}
          <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent-red mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-accent-red mb-1">
                  For Life-Threatening Emergencies
                </p>
                <p className="text-gray-400">
                  If you're in immediate danger, please also call local emergency services (911, 112, etc.) directly.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-accent-red hover:bg-accent-red/90"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Help Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
