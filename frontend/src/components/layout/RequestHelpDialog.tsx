import { useState } from 'react';
import type { HelpRequestType, Urgency, Location, DisasterInfo } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Heart,
  Home,
  Users,
  Package,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { LocationPicker } from './LocationPicker';

interface RequestHelpDialogProps {
  open: boolean;
  onClose: () => void;
  userLocation: Location | null;
  disaster: DisasterInfo;
}

interface FormData {
  type: HelpRequestType;
  urgency: Urgency;
  peopleCount: string;
  description: string;
  userName: string;
  location: Location | null;
}

const HELP_REQUEST_TYPES: { value: HelpRequestType; label: string; icon: any; description: string }[] = [
  {
    value: 'medical',
    label: 'Medical Emergency',
    icon: Heart,
    description: 'Injuries, health crisis, medical supplies needed'
  },
  {
    value: 'rescue',
    label: 'Rescue Needed',
    icon: AlertCircle,
    description: 'Trapped, lost, or unable to evacuate'
  },
  {
    value: 'shelter',
    label: 'Shelter',
    icon: Home,
    description: 'Need safe location or evacuation'
  },
  {
    value: 'food',
    label: 'Food & Water',
    icon: Package,
    description: 'Food or water supply needed'
  },
  {
    value: 'supplies',
    label: 'Supplies',
    icon: Package,
    description: 'Blankets, first aid, equipment'
  },
  {
    value: 'other',
    label: 'Other',
    icon: HelpCircle,
    description: 'Other emergency assistance'
  },
];

const URGENCY_LEVELS: { value: Urgency; label: string; color: string; description: string }[] = [
  {
    value: 'critical',
    label: 'Critical',
    color: 'text-accent-red',
    description: 'Immediate danger, life-threatening'
  },
  {
    value: 'high',
    label: 'High',
    color: 'text-accent-orange',
    description: 'Serious need, time-sensitive'
  },
  {
    value: 'medium',
    label: 'Medium',
    color: 'text-accent-orange',
    description: 'Important, can wait briefly'
  },
  {
    value: 'low',
    label: 'Low',
    color: 'text-accent-green',
    description: 'Non-urgent'
  },
];

export function RequestHelpDialog({
  open,
  onClose,
  userLocation,
  disaster
}: RequestHelpDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    type: 'medical',
    urgency: 'medium',
    peopleCount: '1',
    description: '',
    userName: '',
    location: userLocation,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.userName.trim()) {
      newErrors.userName = 'Name is required';
    }

    if (!formData.location) {
      newErrors.location = 'Location is required - please select your location on the map';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Please provide more details (at least 10 characters)';
    }

    const peopleCountNum = parseInt(formData.peopleCount);
    if (isNaN(peopleCountNum) || peopleCountNum < 1) {
      newErrors.peopleCount = 'Must be at least 1';
    } else if (peopleCountNum > 1000) {
      newErrors.peopleCount = 'Please contact emergency services for large groups';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    // TODO: Replace with actual API call
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const helpRequest = {
      id: `help-${Date.now()}`,
      ...formData,
      peopleCount: parseInt(formData.peopleCount),
      disasterId: disaster.id,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    console.log('Submitting help request:', helpRequest);

    // Save to local storage and download as file
    try {
      // Save to localStorage
      const existingRequests = JSON.parse(localStorage.getItem('help_requests') || '[]');
      existingRequests.push(helpRequest);
      localStorage.setItem('help_requests', JSON.stringify(existingRequests));

      // Download as JSON file
      const dataStr = JSON.stringify(helpRequest, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `help-request-${helpRequest.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error saving help request:', error);
    }

    setSubmitting(false);

    // Reset form
    setFormData({
      type: 'medical',
      urgency: 'medium',
      peopleCount: '1',
      description: '',
      userName: '',
      location: userLocation,
    });
    setErrors({});

    onClose();

    // TODO: Show success toast notification
    alert('Help request submitted successfully! A copy has been saved to your downloads folder.');
  };

  const handleClose = () => {
    if (!submitting) {
      setErrors({});
      onClose();
    }
  };

  const handleLocationChange = (location: Location) => {
    setFormData({ ...formData, location });
    // Clear location error if it exists
    if (errors.location) {
      setErrors({ ...errors, location: undefined });
    }
  };

  const selectedType = HELP_REQUEST_TYPES.find(t => t.value === formData.type);
  const selectedUrgency = URGENCY_LEVELS.find(u => u.value === formData.urgency);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Emergency Help</DialogTitle>
          <DialogDescription>
            Submit your help request. Nearby responders will be notified immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Location Picker */}
          <div className="space-y-2">
            <Label>Your Location *</Label>
            <LocationPicker
              initialLocation={formData.location}
              onLocationChange={handleLocationChange}
            />
            {errors.location && (
              <p className="text-sm text-accent-red">{errors.location}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="userName">Your Name *</Label>
            <Input
              id="userName"
              placeholder="Enter your name"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              disabled={submitting}
            />
            {errors.userName && (
              <p className="text-sm text-accent-red">{errors.userName}</p>
            )}
          </div>

          {/* Help Request Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type of Help Needed *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as HelpRequestType })}
              disabled={submitting}
            >
              <SelectTrigger id="type" className="bg-background-elevated">
                <SelectValue>
                  {selectedType && (
                    <div className="flex items-center gap-2">
                      <selectedType.icon className="w-4 h-4" />
                      <span>{selectedType.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background-elevated border-glass-border">
                {HELP_REQUEST_TYPES.map((type) => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                    className="focus:bg-background-primary"
                  >
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      <div>
                        <div className="font-medium text-gray-200">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Urgency Level */}
          <div className="space-y-2">
            <Label htmlFor="urgency">Urgency Level *</Label>
            <Select
              value={formData.urgency}
              onValueChange={(value) => setFormData({ ...formData, urgency: value as Urgency })}
              disabled={submitting}
            >
              <SelectTrigger id="urgency" className="bg-background-elevated">
                <SelectValue>
                  {selectedUrgency && (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedUrgency.value === 'critical' ? 'bg-accent-red' :
                        selectedUrgency.value === 'high' ? 'bg-accent-orange' :
                        selectedUrgency.value === 'medium' ? 'bg-yellow-500' :
                        'bg-accent-green'
                      }`} />
                      <span className={selectedUrgency.color}>{selectedUrgency.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background-elevated border-glass-border">
                {URGENCY_LEVELS.map((urgency) => (
                  <SelectItem
                    key={urgency.value}
                    value={urgency.value}
                    className="focus:bg-background-primary"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        urgency.value === 'critical' ? 'bg-accent-red' :
                        urgency.value === 'high' ? 'bg-accent-orange' :
                        urgency.value === 'medium' ? 'bg-yellow-500' :
                        'bg-accent-green'
                      }`} />
                      <div>
                        <div className={`font-medium ${urgency.color}`}>{urgency.label}</div>
                        <div className="text-xs text-gray-500">{urgency.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of People */}
          <div className="space-y-2">
            <Label htmlFor="peopleCount">Number of People Affected *</Label>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <Input
                id="peopleCount"
                type="number"
                min="1"
                max="1000"
                placeholder="1"
                value={formData.peopleCount}
                onChange={(e) => setFormData({ ...formData, peopleCount: e.target.value })}
                disabled={submitting}
                className="flex-1"
              />
            </div>
            {errors.peopleCount && (
              <p className="text-sm text-accent-red">{errors.peopleCount}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Describe Your Situation *</Label>
            <Textarea
              id="description"
              placeholder="Please provide details about your situation, location landmarks, and any special needs..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={submitting}
              rows={5}
              className="resize-none"
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
