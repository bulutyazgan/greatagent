import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Location, HelpRequest } from '@/types';
import { defaultMapOptions } from '@/styles/map-theme';
import { VictimMarkers } from './VictimMarkers';
import { HeatmapLayer } from './HeatmapLayer';
import { HeatmapToggle } from './HeatmapToggle';

interface MapContainerProps {
  center: Location;
  zoom?: number;
  helpRequests?: HelpRequest[];
  onMapLoad?: (map: any) => void;
  onMarkerClick?: (request: HelpRequest) => void;
}

// Get API key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Flag to track if setOptions has been called
let optionsConfigured = false;

export function MapContainer({ center, zoom = 15, helpRequests = [], onMapLoad, onMarkerClick }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

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
      }
    };

    initMap();
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (map && center) {
      map.setCenter(center);
    }
  }, [map, center]);

  return (
    <div className="w-full h-full relative">
      {/* Map container - always rendered so ref can attach */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
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
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-secondary z-10">
          <div className="glass p-6 rounded-lg">
            <p className="text-accent-blue">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
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
      {map && !loading && !error && (
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
