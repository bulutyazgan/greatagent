import { useState, useEffect, useCallback } from 'react';
import type { UserRole, DisasterInfo, Location, HelpRequest, HelpRequestStatus } from '@/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useContinuousLocation } from '@/hooks/useContinuousLocation';
import { Header } from './Header';
import { MapContainer } from '@/components/map/MapContainer';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { MyCasePanel } from '@/components/panels/MyCasePanel';
import { MyAssignmentPanel } from '@/components/panels/MyAssignmentPanel';
import { RequestHelpDialog } from './RequestHelpDialog';
import { RequestHelpFAB } from './RequestHelpFAB';
import { CallerGuideDialog } from './CallerGuideDialog';
import { CaseDetailsDialog } from './CaseDetailsDialog';
import { getNearbyCases, type Case, createAssignment, getNearbyHelpers, createOrUpdateUserLocation } from '@/services/api';
import { toast } from 'sonner';
import type { Helper } from '@/components/map/HelperMarkers';
import { CaseGroupPolygons, type CaseGroup } from '@/components/map/CaseGroupPolygons';
import { mockCaseGroups } from '@/data/mock-case-groups';

interface DashboardProps {
  role: UserRole;
  disaster: DisasterInfo;
  onChangeRole: () => void;
}

// Helper function to map backend Case to frontend HelpRequest
function mapCaseToHelpRequest(apiCase: Case): HelpRequest {
  // Map backend status to frontend status
  let status: HelpRequestStatus = 'pending';
  if (apiCase.status === 'assigned' || apiCase.status === 'in_progress') {
    status = 'in_progress';
  } else if (apiCase.status === 'resolved' || apiCase.status === 'closed') {
    status = 'resolved';
  }

  return {
    id: apiCase.case_id.toString(),
    disasterId: 'default-testing',
    userId: apiCase.caller_user_id?.toString() || 'anonymous',
    userName: 'Anonymous',
    type: 'medical',
    location: {
      lat: apiCase.location.latitude,
      lng: apiCase.location.longitude,
    },
    peopleCount: apiCase.people_count || 0,
    urgency: apiCase.urgency,
    status,
    description: apiCase.description || apiCase.raw_problem_description,
    createdAt: new Date(apiCase.created_at),
    vulnerabilityFactors: apiCase.vulnerability_factors || [],
    mobilityStatus: apiCase.mobility_status || undefined,
    timestamp: apiCase.created_at,
  };
}

export function Dashboard({ role, disaster, onChangeRole }: DashboardProps) {
  const { location, loading } = useGeolocation();

  // Stable callback for location updates
  const handleDashboardLocationUpdate = useCallback(async (newLocation: Location) => {
    const userId = localStorage.getItem('beacon_user_id');
    if (userId) {
      try {
        await createOrUpdateUserLocation({
          user_id: userId,
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          is_helper: role === 'responder',
        });
      } catch (err) {
        console.error('Failed to update location:', err);
      }
    }
  }, [role]);

  // Continuous location tracking to update database
  useContinuousLocation({
    enabled: !loading && location !== null,
    updateInterval: 1000,
    onLocationUpdate: handleDashboardLocationUpdate,
  });

  // State to manage map center - can be controlled by user location or help request selection
  const [mapCenter, setMapCenter] = useState<Location>(disaster.center);

  // State for dialog visibility
  const [showRequestHelpDialog, setShowRequestHelpDialog] = useState(false);
  const [showCallerGuideDialog, setShowCallerGuideDialog] = useState(false);
  const [showCaseDetailsDialog, setShowCaseDetailsDialog] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<number | null>(null);
  const [selectedHelpRequest, setSelectedHelpRequest] = useState<HelpRequest | null>(null);

  // State for victim's own case (from localStorage)
  const [myCaseId, setMyCaseId] = useState<number | null>(() => {
    const stored = localStorage.getItem('last_case_id');
    console.log('🔍 Checking localStorage for last_case_id:', stored);
    return stored ? parseInt(stored) : null;
  });

  // State for helper's active assignment (from localStorage)
  const [myAssignmentId, setMyAssignmentId] = useState<number | null>(() => {
    const stored = localStorage.getItem('last_assignment_id');
    return stored ? parseInt(stored) : null;
  });

  // State for help requests from API
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  // State for nearby helpers from API (only for helpers to see)
  const [nearbyHelpers, setNearbyHelpers] = useState<Helper[]>([]);
  const [loadingHelpers, setLoadingHelpers] = useState(false);

  // Update map center when user location changes (but only initially)
  useEffect(() => {
    if (location) {
      setMapCenter(location);
    }
  }, [location]);

  // Fetch nearby cases from API (for both victims and responders)
  useEffect(() => {
    if (!location) return;

    const fetchCases = async () => {
      setLoadingCases(true);
      try {
        const cases = await getNearbyCases(
          location.lat,
          location.lng,
          10, // 10km radius
          ['open', 'assigned']
        );

        const mapped = cases.map(mapCaseToHelpRequest);
        setHelpRequests(mapped);

      } catch (error) {
        console.error('Failed to fetch nearby cases:', error);
      } finally {
        setLoadingCases(false);
      }
    };

    fetchCases();

    // Poll every 10 seconds for updates
    const interval = setInterval(fetchCases, 10000);
    return () => clearInterval(interval);
  }, [location]);

  // Fetch nearby helpers (only for responders)
  useEffect(() => {
    if (!location || role !== 'responder') return;

    const fetchHelpers = async () => {
      setLoadingHelpers(true);
      try {
        const helpers = await getNearbyHelpers(
          location.lat,
          location.lng,
          15 // 15km radius
        );

        setNearbyHelpers(helpers);

      } catch (error) {
        console.error('Failed to fetch nearby helpers:', error);
      } finally {
        setLoadingHelpers(false);
      }
    };

    fetchHelpers();

    // Poll every 15 seconds for updates (less frequent than cases)
    const interval = setInterval(fetchHelpers, 15000);
    return () => clearInterval(interval);
  }, [location, role]);

  const handleRequestHelp = () => {
    console.log('🔴 REQUEST HELP BUTTON CLICKED - Opening dialog');
    console.log('Current state:', { showRequestHelpDialog, role, myCaseId });
    setShowRequestHelpDialog(true);
  };

  const handleRequestSubmitted = (caseId: number) => {
    // Store the case ID for the victim
    setMyCaseId(caseId);

    // Show the caller guide dialog
    setCurrentCaseId(caseId);
    setShowCallerGuideDialog(true);

    // Immediately refresh cases after submission
    if (!location) return;

    getNearbyCases(
      location.lat,
      location.lng,
      10,
      ['open', 'assigned']
    ).then(cases => {
      const mapped = cases.map(mapCaseToHelpRequest);
      setHelpRequests(mapped);
    }).catch(error => {
      console.error('Failed to refresh cases:', error);
    });
  };

  const handleMarkerClick = useCallback((request: HelpRequest) => {
    console.log('Marker clicked:', request);
    if (role === 'responder') {
      setSelectedHelpRequest(request);
      setShowCaseDetailsDialog(true);
    }
  }, [role]);

  const handleClaimCase = async (caseId: string) => {
    const userId = localStorage.getItem('beacon_user_id');
    if (!userId) {
      throw new Error('User not registered. Please refresh the page.');
    }

    const assignment = await createAssignment({
      case_id: parseInt(caseId),
      helper_user_id: parseInt(userId),
    });

    // Store assignment ID in localStorage
    localStorage.setItem('last_assignment_id', assignment.assignment_id.toString());
    setMyAssignmentId(assignment.assignment_id);

    // Refresh cases to update status
    if (location) {
      const cases = await getNearbyCases(
        location.lat,
        location.lng,
        10,
        ['open', 'assigned']
      );
      const mapped = cases.map(mapCaseToHelpRequest);
      setHelpRequests(mapped);
    }
  };

  // Handler for when a help request is clicked from the left panel
  const handleSidebarRequestClick = (request: HelpRequest) => {
    // For responders, show the case details dialog
    if (role === 'responder') {
      setSelectedHelpRequest(request);
      setShowCaseDetailsDialog(true);
    }
    // Center map on the request location
    setMapCenter(request.location);
  };

  // Handler for centering map on a location
  const handleLocationClick = (location: Location) => {
    setMapCenter(location);
  };

  if (loading && !location) {
    return (
      <div className="min-h-screen w-full bg-background-primary flex items-center justify-center">
        <div className="glass p-6 rounded-lg">
          <p className="text-accent-blue">Loading location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background-primary">
      {/* Dev Reset Button - Top Left */}
      <button
        onClick={() => {
          // Clear all localStorage
          localStorage.removeItem('user_role');
          localStorage.removeItem('beacon_user_id');
          localStorage.removeItem('last_case_id');
          localStorage.removeItem('last_assignment_id');
          // Call the onChangeRole to reset state
          onChangeRole();
        }}
        className="fixed top-4 left-4 z-[9999] px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #A67C52 0%, #8B5E34 100%)',
          color: '#F5F1EB',
          border: '1px solid rgba(245, 241, 235, 0.2)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        🔄 Reset to Role Selection
      </button>

      {/* Header - REMOVED for cleaner UI */}
      {/* <Header
        role={role}
        disaster={disaster}
        onChangeRole={onChangeRole}
      /> */}

      {/* MyCasePanel for victims with active case - includes its own map */}
      {role === 'victim' && myCaseId ? (
        <MyCasePanel caseId={myCaseId} />
      ) : role === 'responder' && myAssignmentId ? (
        /* MyAssignmentPanel for helpers with active assignment - includes its own map */
        <MyAssignmentPanel assignmentId={myAssignmentId} />
      ) : (
        <>
          {/* Map Container - Full screen without left panel */}
          <div className="h-screen">
            <MapContainer
              center={mapCenter}
              zoom={role === 'victim' ? 16 : 13}
              helpRequests={helpRequests}
              helpers={role === 'responder' ? nearbyHelpers : []}
              caseGroups={mockCaseGroups}
              userLocation={location}
              userRole={role}
              onMarkerClick={handleMarkerClick}
              onCaseGroupClick={(caseGroup) => console.log('Case group clicked:', caseGroup)}
            />
          </div>
        </>
      )}

      {/* Request Help Dialog */}
      {role === 'victim' && (
        <RequestHelpDialog
          open={showRequestHelpDialog}
          onClose={() => setShowRequestHelpDialog(false)}
          onSubmitSuccess={handleRequestSubmitted}
          userLocation={location}
          disaster={disaster}
        />
      )}

      {/* Caller Guide Dialog */}
      {showCallerGuideDialog && currentCaseId && (
        <CallerGuideDialog
          caseId={currentCaseId}
          onClose={() => {
            setShowCallerGuideDialog(false);
            setCurrentCaseId(null);
          }}
        />
      )}

      {/* Case Details Dialog (Responders only) */}
      {showCaseDetailsDialog && selectedHelpRequest && role === 'responder' && (
        <CaseDetailsDialog
          helpRequest={selectedHelpRequest}
          onClose={() => {
            setShowCaseDetailsDialog(false);
            setSelectedHelpRequest(null);
          }}
          onClaim={handleClaimCase}
        />
      )}

      {/* Request Help FAB (Floating Action Button) - ALWAYS VISIBLE FOR DEBUGGING */}
      {(() => {
        console.log('🎯 FAB Render Check:', { role, myCaseId, shouldShow: role === 'victim' && !myCaseId });
        // TEMPORARILY ALWAYS SHOW THE BUTTON FOR DEBUGGING
        return (
          <RequestHelpFAB onClick={handleRequestHelp} />
        );
      })()}
    </div>
  );
}
