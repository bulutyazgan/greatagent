import { useState } from 'react';
import type { UserRole, DisasterInfo } from '@/types';
import { useUserRole } from '@/hooks/useUserRole';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDisasterSelection } from '@/hooks/useDisasterSelection';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { RoleSelection } from '@/components/role/RoleSelection';
import { Dashboard } from '@/components/layout/Dashboard';
import { RequestHelpDialog } from '@/components/layout/RequestHelpDialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function App() {
  const { role, selectRole, clearRole, hasRole } = useUserRole();
  const { location } = useGeolocation();
  const { selectedDisaster, nearbyDisasters } = useDisasterSelection(location, role);
  const { registerUser, clearIdentity, isLoading: isRegisteringUser } = useUserIdentity();

  const [isRegistering, setIsRegistering] = useState(false);
  const [showInitialHelpDialog, setShowInitialHelpDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const handleRoleSelect = async (selectedRole: UserRole) => {
    // If victim is selected, register user FIRST, then show dialog
    if (selectedRole === 'victim') {
      setPendingRole(selectedRole);

      // Register the user first so we have a user_id
      await completeRegistration(selectedRole);

      // Then show the help dialog
      setShowInitialHelpDialog(true);
      return;
    }

    // For responders, proceed with normal registration
    await completeRegistration(selectedRole);
  };

  const completeRegistration = async (selectedRole: UserRole) => {
    setIsRegistering(true);

    try {
      // Use location if available, otherwise use London fallback
      const lat = location?.lat || 51.5074;
      const lng = location?.lng || -0.1278;

      // Register user with backend
      await registerUser(selectedRole, lat, lng);

      // Update local role state
      selectRole(selectedRole);

    } catch (error) {
      console.error('Failed to register user:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleInitialHelpSubmitted = async (caseId: number) => {
    // After submitting the help request, close dialog and let them see dashboard
    console.log('Help request submitted with case ID:', caseId);
    setShowInitialHelpDialog(false);
    setPendingRole(null);
    // The user is already registered, so hasRole will be true and they'll see the dashboard
  };

  const handleInitialDialogClose = () => {
    // If user closes dialog without submitting, clear everything and go back to role selection
    setShowInitialHelpDialog(false);
    setPendingRole(null);
    clearRole();
    clearIdentity();
  };

  const handleClearRole = () => {
    clearRole();
    clearIdentity();
  };

  // Create a temporary disaster for the initial dialog
  const tempDisaster: DisasterInfo = {
    id: 'temp-initial',
    name: 'Emergency Response',
    type: 'flood' as const,
    date: new Date(),
    location: 'Current Location',
    center: location || { lat: 51.5074, lng: -0.1278 },
    severity: 'moderate' as const,
    affectedRadius: 50,
    isActive: true,
  };

  // Show role selection if no role chosen
  if (!hasRole) {
    return (
      <>
        <RoleSelection onSelectRole={handleRoleSelect} />

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

  // Show help request dialog immediately after victim registers (before dashboard)
  if (hasRole && showInitialHelpDialog) {
    return (
      <>
        <RequestHelpDialog
          open={showInitialHelpDialog}
          onClose={handleInitialDialogClose}
          onSubmitSuccess={handleInitialHelpSubmitted}
          userLocation={location}
          disaster={tempDisaster}
        />
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
    />
  );
}

export default App;
