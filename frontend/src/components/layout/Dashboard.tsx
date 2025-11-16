import { useState, useEffect } from 'react';
import type { UserRole, DisasterInfo, Location, HelpRequest } from '@/types';
import { Header } from './Header';
import { MapContainer } from '@/components/map/MapContainer';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { RequestHelpFAB } from './RequestHelpFAB';
import { RequestHelpDialog } from './RequestHelpDialog';
import { getNearbyCases, type Case } from '@/services/api';

interface DashboardProps {
  role: UserRole;
  disaster: DisasterInfo;
  onChangeRole: () => void;
  userLocation: Location | null;
  isLocationLoading: boolean;
  requestHelpPromptVersion: number;
}

// Helper function to map backend Case to frontend HelpRequest
function mapCaseToHelpRequest(apiCase: Case, disasterId: string): HelpRequest {
  return {
    id: apiCase.case_id.toString(),
    disasterId,
    userId: apiCase.caller_user_id ? apiCase.caller_user_id.toString() : 'anonymous',
    userName: apiCase.description ? apiCase.description.slice(0, 24) : 'Anonymous caller',
    type: 'medical', // Default type, could be inferred from description
    location: {
      lat: apiCase.location.latitude,
      lng: apiCase.location.longitude,
    },
    peopleCount: apiCase.people_count ?? 0,
    urgency: apiCase.urgency,
    status: apiCase.status as any,
    description: apiCase.description || apiCase.raw_problem_description,
    createdAt: new Date(apiCase.created_at),
  };
}

export function Dashboard({
  role,
  disaster,
  onChangeRole,
  userLocation,
  isLocationLoading,
  requestHelpPromptVersion,
}: DashboardProps) {

  // State to manage map center - can be controlled by user location or help request selection
  const [mapCenter, setMapCenter] = useState<Location>(disaster.center);

  // State for dialog visibility
  const [showRequestHelpDialog, setShowRequestHelpDialog] = useState(false);

  // State for help requests from API
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);

  // Victims should center map on their own location (helpers view bounded cases instead)
  useEffect(() => {
    if (role === 'victim' && userLocation) {
      setMapCenter(userLocation);
    }
  }, [userLocation, role]);

  // Fetch nearby cases from API (for both victims and responders)
  useEffect(() => {
    if (!userLocation) return;

    const fetchCases = async () => {
      try {
        const radiusKm = role === 'responder' ? 100 : 10;
        const cases = await getNearbyCases(
          userLocation.lat,
          userLocation.lng,
          radiusKm
        );

        const mapped = cases.map((item) => mapCaseToHelpRequest(item, disaster.id));
        setHelpRequests(mapped);

      } catch (error) {
        console.error('Failed to fetch nearby cases:', error);
      } finally {
        // intentionally left blank
      }
    };

    fetchCases();

    // Poll every 10 seconds for updates
    const interval = setInterval(fetchCases, 10000);
    return () => clearInterval(interval);
  }, [userLocation, role]);

  useEffect(() => {
    if (requestHelpPromptVersion > 0) {
      setShowRequestHelpDialog(true);
    }
  }, [requestHelpPromptVersion]);

  const handleRequestHelp = () => {
    setShowRequestHelpDialog(true);
  };

  const handleRequestSubmitted = () => {
    // Immediately refresh cases after submission
    if (!userLocation) return;

    const radiusKm = role === 'responder' ? 100 : 10;
    getNearbyCases(
      userLocation.lat,
      userLocation.lng,
      radiusKm
    ).then(cases => {
      const mapped = cases.map((item) => mapCaseToHelpRequest(item, disaster.id));
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

  if (isLocationLoading && !userLocation) {
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

      {/* Left Panel with Tabs */}
      <LeftPanel role={role} onHelpRequestClick={handleHelpRequestClick} />

      {/* Map Container */}
      <div className="pt-16 h-screen">
        <MapContainer
          center={mapCenter}
          zoom={role === 'victim' ? 16 : 13}
          helpRequests={helpRequests}
          userLocation={userLocation}
          onMarkerClick={handleMarkerClick}
          fitToRequests={role === 'responder'}
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
          userLocation={userLocation}
        />
      )}
    </div>
  );
}
