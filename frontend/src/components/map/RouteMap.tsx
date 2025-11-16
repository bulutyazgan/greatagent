import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Location } from '@/types';
import { defaultMapOptions, cleanHybridTheme } from '@/styles/map-theme';
import { UserLocationMarker } from './UserLocationMarker';

interface RouteMapProps {
  helperLocation: Location | null;
  victimLocation: Location;
  onRouteCalculated?: (distance: string, duration: string) => void;
  travelMode?: 'DRIVING' | 'WALKING';
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
let optionsConfigured = false;

export function RouteMap({ helperLocation, victimLocation, onRouteCalculated, travelMode = 'DRIVING' }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastRouteCalcRef = useRef<{ helper: Location | null; victim: Location; mode: string } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error('Google Maps API key is not configured.');
        }

        if (!optionsConfigured) {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: 'weekly',
          });
          optionsConfigured = true;
        }

        const { Map } = await importLibrary('maps');

        if (!mapRef.current) return;

        // Center map between helper and victim locations
        const center = helperLocation || victimLocation;

        const mapInstance = new Map(mapRef.current, {
          ...defaultMapOptions,
          center,
          zoom: 14,
          styles: cleanHybridTheme,
        });

        mapInstance.setMapTypeId('hybrid');

        // Create directions renderer
        const renderer = new window.google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: true, // We'll use custom markers
          polylineOptions: {
            strokeColor: '#00FF00', // Bright green route color
            strokeWeight: 6,
            strokeOpacity: 0.7,
          },
        });

        setMap(mapInstance);
        setDirectionsRenderer(renderer);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading Google Maps:', err);
        setError(err?.message || 'Failed to load map.');
        setLoading(false);
      }
    };

    initMap();
  }, []);

  // Calculate route when locations or travel mode changes
  useEffect(() => {
    if (!map || !directionsRenderer || !helperLocation || !victimLocation) return;

    // Check if we need to recalculate (new mode or first time)
    const needsRecalc = !lastRouteCalcRef.current ||
                        lastRouteCalcRef.current.mode !== travelMode;

    if (!needsRecalc) return;

    const calculateRoute = async () => {
      try {
        const directionsService = new window.google.maps.DirectionsService();

        const request = {
          origin: helperLocation,
          destination: victimLocation,
          travelMode: window.google.maps.TravelMode[travelMode],
        };

        directionsService.route(request, (result: any, status: any) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);

            // Extract distance and duration
            const route = result.routes[0];
            const leg = route.legs[0];

            if (onRouteCalculated) {
              onRouteCalculated(leg.distance.text, leg.duration.text);
            }

            // Update last calculated location and mode
            lastRouteCalcRef.current = {
              helper: helperLocation,
              victim: victimLocation,
              mode: travelMode,
            };
          } else {
            console.error('Directions request failed:', status);
          }
        });
      } catch (err) {
        console.error('Error calculating route:', err);
      }
    };

    calculateRoute();
  }, [map, directionsRenderer, helperLocation, victimLocation, onRouteCalculated, travelMode]);

  console.log('[RouteMap] Rendering with:', {
    hasMap: !!map,
    helperLocation,
    victimLocation,
    willRenderVictimMarker: !!(map && victimLocation)
  });

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Helper location marker (your position) */}
      {helperLocation && (
        <UserLocationMarker
          map={map}
          userLocation={helperLocation}
          userRole="responder"
        />
      )}

      {/* Victim location marker */}
      {map && victimLocation && (
        <VictimMarker
          map={map}
          location={victimLocation}
        />
      )}

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-secondary z-10">
          <div className="glass p-6 rounded-lg">
            <p className="text-accent-blue">Loading route...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-secondary z-10">
          <div className="glass p-6 rounded-lg max-w-md text-center">
            <p className="text-accent-red mb-2 font-bold">Map Loading Error</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple victim marker component for destination
function VictimMarker({ map, location }: { map: any; location: Location }) {
  useEffect(() => {
    if (!map || !window.google || !location) return;

    class CustomVictimMarker extends window.google.maps.OverlayView {
      position: any;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: any) {
        super();
        this.position = position;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.zIndex = '100';

        div.innerHTML = `
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 3px solid #8B2420;
            overflow: hidden;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
            background: white;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <img src="/assets/sad.png" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
        `;

        this.containerDiv = div;
        const panes = this.getPanes();
        panes!.overlayImage.appendChild(div);
      }

      draw() {
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(
          new window.google.maps.LatLng(this.position.lat, this.position.lng)
        );

        if (this.containerDiv) {
          this.containerDiv.style.left = (position.x - 20) + 'px';
          this.containerDiv.style.top = (position.y - 20) + 'px';
        }
      }

      onRemove() {
        if (this.containerDiv) {
          this.containerDiv.parentNode?.removeChild(this.containerDiv);
          this.containerDiv = null;
        }
      }
    }

    const marker = new CustomVictimMarker(location);
    marker.setMap(map);

    return () => {
      marker.setMap(null);
    };
  }, [map, location]);

  return null;
}
