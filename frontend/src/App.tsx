import { useState, useEffect } from 'react';
import type { UserRole, DisasterInfo } from '@/types';
import { useUserRole } from '@/hooks/useUserRole';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDisasterSelection } from '@/hooks/useDisasterSelection';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { RoleSelection } from '@/components/role/RoleSelection';
import { VoiceSelectionDialog } from '@/components/role/VoiceSelectionDialog';
import { VoiceConversationScreen } from '@/components/voice/VoiceConversationScreen';
import { Dashboard } from '@/components/layout/Dashboard';
import { RequestHelpDialog } from '@/components/layout/RequestHelpDialog';
import { CallerGuideDialog } from '@/components/layout/CallerGuideDialog';
import { AgentDashboard } from '@/components/dashboard/AgentDashboard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function App() {
  // Check if dashboard mode is requested via URL
  const [isDashboardMode, setIsDashboardMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsDashboardMode(params.get('dashboard') === 'true');
  }, []);
  const { role, selectRole, clearRole, hasRole } = useUserRole();
  const { location } = useGeolocation();
  const { selectedDisaster, nearbyDisasters } = useDisasterSelection(location, role);
  const { registerUser, clearIdentity, isLoading: isRegisteringUser } = useUserIdentity();

  const [isRegistering, setIsRegistering] = useState(false);
  const [showVoiceSelection, setShowVoiceSelection] = useState(false);
  const [useVoiceMode, setUseVoiceMode] = useState(false);
  const [showVoiceConversation, setShowVoiceConversation] = useState(false);
  const [showInitialHelpDialog, setShowInitialHelpDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [showCallerGuideDialog, setShowCallerGuideDialog] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<number | null>(null);

  const handleRoleSelect = async (selectedRole: UserRole) => {
    // If victim is selected, register user FIRST, then show voice selection
    if (selectedRole === 'victim') {
      setPendingRole(selectedRole);

      // Register the user first so we have a user_id
      await completeRegistration(selectedRole);

      // Then show voice mode selection dialog
      setShowVoiceSelection(true);
      return;
    }

    // For responders, proceed with normal registration
    await completeRegistration(selectedRole);
  };

  const handleVoiceModeSelect = (useVoice: boolean) => {
    setUseVoiceMode(useVoice);
    setShowVoiceSelection(false);

    if (useVoice) {
      // Show voice conversation screen
      setShowVoiceConversation(true);
    } else {
      // Show traditional text form
      setShowInitialHelpDialog(true);
    }
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
    // After submitting the help request, store case ID and show caller guide
    console.log('Help request submitted with case ID:', caseId);

    // Store case ID in localStorage
    localStorage.setItem('last_case_id', caseId.toString());

    // Close help dialog
    setShowInitialHelpDialog(false);
    setPendingRole(null);

    // Show caller guide dialog
    setCurrentCaseId(caseId);
    setShowCallerGuideDialog(true);
  };

  const handleVoiceCaseCreated = async (caseId: number) => {
    // After voice conversation creates a case
    console.log('Voice case created with ID:', caseId);

    // Store case ID in localStorage
    localStorage.setItem('last_case_id', caseId.toString());

    // Close voice conversation
    setShowVoiceConversation(false);
    setPendingRole(null);

    // Show caller guide dialog
    setCurrentCaseId(caseId);
    setShowCallerGuideDialog(true);
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

  // If dashboard mode, render AgentDashboard
  if (isDashboardMode) {
    return <AgentDashboard />;
  }

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

  // Show voice mode selection after victim registers (only for victims)
  if (hasRole && showVoiceSelection) {
    return <VoiceSelectionDialog onSelectVoiceMode={handleVoiceModeSelect} />;
  }

  // Show voice conversation screen
  if (hasRole && showVoiceConversation) {
    return (
      <VoiceConversationScreen
        userLocation={location}
        disaster={tempDisaster}
        onCaseCreated={handleVoiceCaseCreated}
      />
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

  // Show caller guide dialog after initial help request submission
  if (hasRole && showCallerGuideDialog && currentCaseId) {
    return (
      <>
        <CallerGuideDialog
          caseId={currentCaseId}
          onClose={() => {
            setShowCallerGuideDialog(false);
            setCurrentCaseId(null);
            // User will now see the dashboard
          }}
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
