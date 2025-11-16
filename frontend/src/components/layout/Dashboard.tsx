import { useState, useEffect } from 'react';
import type { UserRole, DisasterInfo, Location, HelpRequest, HelpRequestStatus } from '@/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Header } from './Header';
import { MapContainer } from '@/components/map/MapContainer';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { MyCasePanel } from '@/components/panels/MyCasePanel';
import { RequestHelpFAB } from './RequestHelpFAB';
import { RequestHelpDialog } from './RequestHelpDialog';
import { CallerGuideDialog } from './CallerGuideDialog';
import { getNearbyCases, type Case } from '@/services/api';

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

  // State to manage map center - can be controlled by user location or help request selection
  const [mapCenter, setMapCenter] = useState<Location>(disaster.center);

  // State for dialog visibility
  const [showRequestHelpDialog, setShowRequestHelpDialog] = useState(false);
  const [showCallerGuideDialog, setShowCallerGuideDialog] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<number | null>(null);

  // State for victim's own case (from localStorage)
  const [myCaseId, setMyCaseId] = useState<number | null>(() => {
    const stored = localStorage.getItem('last_case_id');
    return stored ? parseInt(stored) : null;
  });

  // State for help requests from API
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

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

  const handleRequestHelp = () => {
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

  const handleMarkerClick = (request: any) => {
    console.log('Victim marker clicked:', request);
    // TODO: Show help request details dialog
  };

  // Handler for when a help request is clicked from the left panel
  const handleHelpRequestClick = (requestLocation: Location) => {
    setMapCenter(requestLocation);
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
      {/* Header */}
      <Header
        role={role}
        disaster={disaster}
        onChangeRole={onChangeRole}
      />

      {/* Left Panel - Show MyCasePanel for victims with active case, otherwise show LeftPanel */}
      {role === 'victim' && myCaseId ? (
        <MyCasePanel caseId={myCaseId} />
      ) : (
        <LeftPanel role={role} onHelpRequestClick={handleHelpRequestClick} />
      )}

      {/* Map Container */}
      <div className="pt-16 h-screen">
        <MapContainer
          center={mapCenter}
          zoom={role === 'victim' ? 16 : 13}
          helpRequests={helpRequests}
          userLocation={location}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* Request Help FAB (only for victims) */}
      {role === 'victim' && <RequestHelpFAB onClick={handleRequestHelp} />}

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
    </div>
  );
}
