import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Location } from '@/types';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationPickerProps {
  initialLocation: Location | null;
  onLocationChange: (location: Location) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
let optionsConfigured = false;

export function LocationPicker({ initialLocation, onLocationChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(initialLocation);

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          console.error('Google Maps API key is not configured');
          setLoading(false);
          return;
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
        const { Marker } = await importLibrary('marker');
        const { Autocomplete } = await importLibrary('places');

        const center = initialLocation || { lat: 51.5074, lng: -0.1278 };

        const mapInstance = new Map(mapRef.current!, {
          center,
          zoom: 15,
          mapId: 'location-picker-map',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Create marker
        const marker = new Marker({
          position: center,
          map: mapInstance,
          draggable: true,
          title: 'Your Location',
        });

        markerRef.current = marker;

        // Update location when marker is dragged
        marker.addListener('dragend', () => {
          const position = marker.getPosition();
          if (position) {
            const newLocation = {
              lat: position.lat(),
              lng: position.lng(),
            };
            setSelectedLocation(newLocation);
            onLocationChange(newLocation);
          }
        });

        // Update location when map is clicked
        mapInstance.addListener('click', (e: any) => {
          const newLocation = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          };
          marker.setPosition(e.latLng);
          setSelectedLocation(newLocation);
          onLocationChange(newLocation);
        });

        // Setup autocomplete for search input
        if (inputRef.current) {
          const autocomplete = new Autocomplete(inputRef.current, {
            fields: ['geometry', 'name', 'formatted_address'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
              const newLocation = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };
              mapInstance.setCenter(newLocation);
              marker.setPosition(newLocation);
              setSelectedLocation(newLocation);
              onLocationChange(newLocation);
            }
          });

          autocompleteRef.current = autocomplete;
        }

        setMap(mapInstance);
        setLoading(false);
      } catch (err) {
        console.error('Error loading map:', err);
        setLoading(false);
      }
    };

    initMap();
  }, []);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (map && markerRef.current) {
            map.setCenter(newLocation);
            markerRef.current.setPosition(newLocation);
            setSelectedLocation(newLocation);
            onLocationChange(newLocation);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for a location..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-glass-border">
        <div
          ref={mapRef}
          className="w-full h-64"
          style={{ minHeight: '256px' }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background-elevated/80 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Location Info and Actions */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4" />
          {selectedLocation ? (
            <span>
              {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
            </span>
          ) : (
            <span>Click on map to set location</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
        >
          Use Current Location
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Click on the map or drag the marker to adjust your location. You can also search for an address above.
      </p>
    </div>
  );
}
