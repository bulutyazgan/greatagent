import { useState, useEffect, useRef } from 'react';
import type { Location } from '@/types';
import { defaultCenter } from '@/data/mock-disaster';

interface UseContinuousLocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
  onLocationUpdate?: (location: Location) => void;
}

export function useContinuousLocation({
  enabled = true,
  updateInterval = 1000, // Update every second by default
  onLocationUpdate,
}: UseContinuousLocationOptions = {}) {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const callbackRef = useRef(onLocationUpdate);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLocation(defaultCenter);
      setLoading(false);
      return;
    }

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation(newLocation);
        setLoading(false);
        setError(null);

        // Call callback with new location using ref
        if (callbackRef.current) {
          callbackRef.current(newLocation);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setError(err.message);

        // Fall back to default center if we don't have a location yet
        if (!location) {
          setLocation(defaultCenter);
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    // Cleanup function
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled]); // Removed onLocationUpdate from deps

  return { location, error, loading };
}
