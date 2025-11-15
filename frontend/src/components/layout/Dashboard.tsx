import { useState, useEffect } from 'react';
import type { UserRole, DisasterInfo, Location } from '@/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Header } from './Header';
import { MapContainer } from '@/components/map/MapContainer';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { RequestHelpFAB } from './RequestHelpFAB';
import { RequestHelpDialog } from './RequestHelpDialog';
import { getHelpRequestsByDisaster } from '@/data/mock-help-requests';

interface DashboardProps {
  role: UserRole;
  disaster: DisasterInfo;
  onChangeRole: () => void;
}

export function Dashboard({ role, disaster, onChangeRole }: DashboardProps) {
  const { location, loading } = useGeolocation();

  // State to manage map center - can be controlled by user location or help request selection
  const [mapCenter, setMapCenter] = useState<Location>(disaster.center);

  // State for dialog visibility
  const [showRequestHelpDialog, setShowRequestHelpDialog] = useState(false);

  // Update map center when user location changes (but only initially)
  useEffect(() => {
    if (location) {
      setMapCenter(location);
    }
  }, [location]);

  const handleRequestHelp = () => {
    setShowRequestHelpDialog(true);
  };

  const handleMarkerClick = (request: any) => {
    console.log('Victim marker clicked:', request);
    // TODO: Show help request details dialog
  };

  // Handler for when a help request is clicked from the left panel
  const handleHelpRequestClick = (requestLocation: Location) => {
    setMapCenter(requestLocation);
  };

  // Get help requests for this disaster
  const helpRequests = getHelpRequestsByDisaster(disaster.id);

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

      {/* Left Panel with Tabs */}
      <LeftPanel role={role} onHelpRequestClick={handleHelpRequestClick} />

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
          userLocation={location}
          disaster={disaster}
        />
      )}
    </div>
  );
}
