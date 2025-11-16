import { useEffect, useMemo, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Location, HelpRequest } from '@/types';
import { defaultMapOptions } from '@/styles/map-theme';
import { VictimMarkers } from './VictimMarkers';
import { HeatmapLayer } from './HeatmapLayer';
import { HeatmapToggle } from './HeatmapToggle';
import { UserLocationMarker } from './UserLocationMarker';
import { MapContainer as LeafletMapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapContainerProps {
  center: Location;
  zoom?: number;
  helpRequests?: HelpRequest[];
  userLocation?: Location | null;
  onMapLoad?: (map: any) => void;
  onMarkerClick?: (request: HelpRequest) => void;
  fitToRequests?: boolean;
}

// Get API key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Flag to track if setOptions has been called
let optionsConfigured = false;

const URGENCY_COLORS: Record<string, string> = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffa940',
  low: '#40a9ff',
};

interface FallbackMapProps {
  center: Location;
  zoom: number;
  helpRequests: HelpRequest[];
  userLocation?: Location | null;
  onMarkerClick?: (request: HelpRequest) => void;
}

function LeafletFallbackMap({
  center,
  zoom,
  helpRequests,
  userLocation,
  onMarkerClick,
}: FallbackMapProps) {
  return (
    <div className="w-full h-full relative">
      <LeafletMapContainer
        center={[center.lat, center.lng] as [number, number]}
        zoom={zoom}
        className="w-full h-full min-h-[400px]"
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {helpRequests.map((request) => (
          <CircleMarker
            key={request.id}
            center={[request.location.lat, request.location.lng] as [number, number]}
            radius={10}
            pathOptions={{
              color: URGENCY_COLORS[request.urgency] || '#ffffff',
              fillColor: URGENCY_COLORS[request.urgency] || '#ffffff',
              fillOpacity: 0.7,
            }}
            eventHandlers={{
              click: () => onMarkerClick?.(request),
            }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold">{request.description || 'Help request'}</p>
                <p className="text-sm text-gray-600">Urgency: {request.urgency}</p>
                {request.peopleCount && (
                  <p className="text-sm text-gray-600">People: {request.peopleCount}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng] as [number, number]}
            radius={8}
            pathOptions={{
              color: '#00c2ff',
              fillColor: '#00c2ff',
              fillOpacity: 0.8,
            }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}
      </LeafletMapContainer>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background-secondary/90 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
        Using fallback map (OpenStreetMap tiles)
      </div>
    </div>
  );
}

export function MapContainer({
  center,
  zoom = 15,
  helpRequests = [],
  userLocation,
  onMapLoad,
  onMarkerClick,
  fitToRequests = false,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [useFallback, setUseFallback] = useState(!GOOGLE_MAPS_API_KEY);
  const fallbackCenter = useMemo<Location>(() => center || (userLocation ?? { lat: 0, lng: 0 }), [center, userLocation]);

  useEffect(() => {
    if (useFallback || !mapRef.current) {
      setLoading(false);
      return;
    }

    const initMap = async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error('Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
        }

        // Configure API options (only once)
        if (!optionsConfigured) {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: 'weekly',
          });
          optionsConfigured = true;
        }

        const { Map } = await importLibrary('maps');

        if (!mapRef.current) return;

        const mapInstance = new Map(mapRef.current, {
          ...defaultMapOptions,
          center,
          zoom,
        });

        setMap(mapInstance);
        setLoading(false);

        if (onMapLoad) {
          onMapLoad(mapInstance);
        }
      } catch (err: any) {
        console.error('Error loading Google Maps:', err);
        setError(err?.message || 'Failed to load map. Please check your API key and billing settings.');
        setLoading(false);
        setUseFallback(true);
      }
    };

    initMap();
  }, [useFallback]);

  // Update center when it changes
  useEffect(() => {
    if (useFallback) return;
    if (map && center) {
      map.setCenter(center);
    }
  }, [map, center, useFallback]);

  // Fit map bounds to include all help requests (and user location) when requested
  useEffect(() => {
    if (useFallback) return;
    if (!map || !fitToRequests || helpRequests.length === 0) return;
    const googleMaps = (window as any)?.google?.maps;
    if (!googleMaps) return;

    const bounds = new googleMaps.LatLngBounds();
    helpRequests.forEach((request) => {
      bounds.extend({ lat: request.location.lat, lng: request.location.lng });
    });
    if (userLocation) {
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
    }

    map.fitBounds(bounds, 80);
  }, [map, helpRequests, fitToRequests, userLocation, useFallback]);

  if (useFallback) {
    return (
      <LeafletFallbackMap
        center={fallbackCenter}
        zoom={zoom}
        helpRequests={helpRequests}
        userLocation={userLocation}
        onMarkerClick={onMarkerClick}
      />
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Map container - always rendered so ref can attach */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* User location marker */}
      <UserLocationMarker
        map={map}
        userLocation={userLocation || null}
      />

      {/* Victim markers */}
      <VictimMarkers
        map={map}
        helpRequests={helpRequests}
        onMarkerClick={onMarkerClick}
      />

      {/* Heatmap layer */}
      <HeatmapLayer
        map={map}
        helpRequests={helpRequests}
        visible={showHeatmap}
      />

      {/* Loading overlay */}
      {!useFallback && loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-secondary z-10">
          <div className="glass p-6 rounded-lg">
            <p className="text-accent-blue">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {!useFallback && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-secondary z-10">
          <div className="glass p-6 rounded-lg max-w-md text-center">
            <p className="text-accent-red mb-2 font-bold">Map Loading Error</p>
            <p className="text-sm text-gray-400 mb-4">{error}</p>
            <div className="text-xs text-gray-500 space-y-2 text-left">
              <p className="font-semibold text-gray-400">Common solutions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ensure VITE_GOOGLE_MAPS_API_KEY is in your .env file</li>
                <li>Check that Maps JavaScript API is enabled in Google Cloud Console</li>
                <li>Verify billing is enabled for your Google Cloud project</li>
                <li>Check browser console for detailed error messages</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap toggle button */}
      {!useFallback && map && !loading && !error && (
        <div className="absolute top-4 right-4 z-10">
          <HeatmapToggle
            visible={showHeatmap}
            onToggle={() => setShowHeatmap(!showHeatmap)}
          />
        </div>
      )}
    </div>
  );
}
