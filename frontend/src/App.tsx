import { useState } from 'react';
import type { UserRole, DisasterInfo } from '@/types';
import { useUserRole } from '@/hooks/useUserRole';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDisasterSelection } from '@/hooks/useDisasterSelection';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { RoleSelection } from '@/components/role/RoleSelection';
import { Dashboard } from '@/components/layout/Dashboard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function App() {
  const { role, selectRole, clearRole, hasRole } = useUserRole();
  const { location, error: locationError, loading: isLocating, requestLocation } = useGeolocation();
  const { selectedDisaster } = useDisasterSelection(location, role);
  const { registerUser, clearIdentity } = useUserIdentity();

  const [isRegistering, setIsRegistering] = useState(false);
  const [requestHelpPromptVersion, setRequestHelpPromptVersion] = useState(0);

  const handleRoleSelect = async (selectedRole: UserRole) => {
    // Need location to register
    if (!location) {
      toast.error('Location required', {
        description: 'Please enable location services to continue',
      });
      return;
    }

    setIsRegistering(true);

    try {
      // Register user with backend
      await registerUser(selectedRole, location.lat, location.lng);

      // Update local role state
      selectRole(selectedRole);

      toast.success('Registration successful', {
        description: `You're registered as ${selectedRole === 'victim' ? 'someone needing help' : 'a helper'}`,
      });

      if (selectedRole === 'victim') {
        setRequestHelpPromptVersion((version) => version + 1);
      }

    } catch (error) {
      console.error('Failed to register user:', error);

      let errorMessage = 'Please try again';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Extract detail from APIError if available
        if ('detail' in error && error.detail) {
          if (typeof error.detail === 'string') {
            errorMessage = error.detail;
          } else if (Array.isArray(error.detail)) {
            // Pydantic validation errors
            errorMessage = error.detail.map((e: any) =>
              `${e.loc.join('.')}: ${e.msg}`
            ).join(', ');
          }
        }
      }

      toast.error('Registration failed', {
        description: errorMessage,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleClearRole = () => {
    clearRole();
    clearIdentity();
  };

  // Show role selection if no role chosen
  if (!hasRole) {
    return (
      <>
        <RoleSelection onSelectRole={handleRoleSelect} />

        {(!location) && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
            <div className="glass max-w-md w-full p-6 rounded-lg space-y-4 text-center">
              <h2 className="text-2xl font-semibold text-white">Share your location</h2>
              <p className="text-gray-300">
                We need your location to match helpers and people needing assistance nearby.
                Please allow location access to continue.
              </p>

              {locationError && (
                <p className="text-sm text-red-400">{locationError}</p>
              )}

              {isLocating ? (
                <div className="flex items-center justify-center gap-3 text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Requesting permission…</span>
                </div>
              ) : (
                <button
                  className="w-full py-2 rounded bg-accent-blue text-white font-medium hover:bg-accent-blue/80 transition-colors"
                  onClick={requestLocation}
                >
                  Allow Location Access
                </button>
              )}
            </div>
          </div>
        )}

        {isRegistering && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass p-8 rounded-lg flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-lg">Registering...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Create a default disaster for testing if none detected
  const effectiveDisaster: DisasterInfo = selectedDisaster || {
    id: 'default-testing',
    name: 'Emergency Response Testing',
    type: 'flood' as const,
    date: new Date(),
    location: 'Test Location',
    center: location || { lat: 51.5074, lng: -0.1278 },
    severity: 'moderate' as const,
    affectedRadius: 50,
    isActive: true,
  };

  // Show main dashboard
  return (
    <Dashboard
      role={role!}
      disaster={effectiveDisaster}
      onChangeRole={handleClearRole}
      userLocation={location}
      isLocationLoading={isLocating}
      requestHelpPromptVersion={requestHelpPromptVersion}
    />
  );
}

export default App;
