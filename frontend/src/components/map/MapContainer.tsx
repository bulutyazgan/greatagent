import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Location } from '@/types';
import { defaultMapOptions } from '@/styles/map-theme';

interface MapContainerProps {
  center: Location;
  zoom?: number;
  onMapLoad?: (map: any) => void;
}

// Get API key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

console.log('Google Maps API Key loaded:', GOOGLE_MAPS_API_KEY ? 'Yes (key present)' : 'No (missing)');
console.log('API Key first 10 chars:', GOOGLE_MAPS_API_KEY?.substring(0, 10));

if (!GOOGLE_MAPS_API_KEY) {
  console.error('VITE_GOOGLE_MAPS_API_KEY is not defined in .env file');
}

// Flag to track if setOptions has been called
let optionsConfigured = false;

export function MapContainer({ center, zoom = 15, onMapLoad }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('useEffect triggered, mapRef.current:', mapRef.current);
    if (!mapRef.current) {
      console.log('mapRef.current is null, skipping map initialization');
      return;
    }

    const initMap = async () => {
      try {
        console.log('initMap called');
        console.log('API key value:', GOOGLE_MAPS_API_KEY);
        console.log('API key type:', typeof GOOGLE_MAPS_API_KEY);
        console.log('API key length:', GOOGLE_MAPS_API_KEY?.length);

        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error('Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
        }

        // Configure API options (only once)
        if (!optionsConfigured) {
          console.log('Configuring Google Maps API options...');
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: 'weekly',
          });
          optionsConfigured = true;
          console.log('Google Maps API options configured');
        }

        console.log('About to import maps library...');
        const { Map } = await importLibrary('maps');
        console.log('Maps library imported successfully');

        if (!mapRef.current) return;

        console.log('Creating map instance with:', { center, zoom });
        const mapInstance = new Map(mapRef.current, {
          ...defaultMapOptions,
          center,
          zoom,
        });
        console.log('Map instance created:', mapInstance);

        setMap(mapInstance);
        setLoading(false);
        console.log('Map state updated, loading set to false');

        if (onMapLoad) {
          onMapLoad(mapInstance);
        }
      } catch (err: any) {
        console.error('Error loading Google Maps:', err);
        console.error('Error details:', {
          message: err?.message,
          stack: err?.stack,
          name: err?.name
        });
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
    </div>
  );
}
