import { useEffect, useRef } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import type { HelpRequest } from '@/types';

interface HeatmapLayerProps {
  map: any; // Google Maps Map instance
  helpRequests: HelpRequest[];
  visible: boolean;
}

export function HeatmapLayer({ map, helpRequests, visible }: HeatmapLayerProps) {
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  const calculateWeightedPoints = (
    requests: HelpRequest[]
  ): google.maps.visualization.WeightedLocation[] => {
    const urgencyMultipliers = {
      critical: 3,
      high: 2,
      medium: 1.5,
      low: 1,
    };

    return requests.map((request) => ({
      location: new window.google.maps.LatLng(
        request.location.lat,
        request.location.lng
      ),
      weight: request.peopleCount * urgencyMultipliers[request.urgency],
    }));
  };

  useEffect(() => {
    if (!map || !window.google) return;

    const initHeatmap = async () => {
      try {
        // Load visualization library
        await importLibrary('visualization');

        // Calculate weighted points
        const weightedPoints = calculateWeightedPoints(helpRequests);

        // Create heatmap layer
        const heatmap = new window.google.maps.visualization.HeatmapLayer({
          data: weightedPoints,
          map: visible ? map : null,
          radius: 40,
          opacity: 0.6,
          gradient: [
            'rgba(0, 255, 255, 0)',
            'rgba(0, 255, 255, 1)',
            'rgba(0, 191, 255, 1)',
            'rgba(0, 127, 255, 1)',
            'rgba(0, 63, 255, 1)',
            'rgba(0, 0, 255, 1)',
            'rgba(0, 0, 223, 1)',
            'rgba(0, 0, 191, 1)',
            'rgba(0, 0, 159, 1)',
            'rgba(0, 0, 127, 1)',
            'rgba(63, 0, 91, 1)',
            'rgba(127, 0, 63, 1)',
            'rgba(191, 0, 31, 1)',
            'rgba(255, 0, 0, 1)',
          ],
        });

        heatmapRef.current = heatmap;
      } catch (err) {
        console.error('Error loading visualization library:', err);
      }
    };

    initHeatmap();

    // Cleanup
    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [map]);

  // Update heatmap data when help requests change
  useEffect(() => {
    if (!heatmapRef.current || !window.google || helpRequests.length === 0) return;

    const weightedPoints = calculateWeightedPoints(helpRequests);
    heatmapRef.current.setData(weightedPoints);
  }, [helpRequests]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!heatmapRef.current) return;

    heatmapRef.current.setMap(visible ? map : null);
  }, [visible, map]);

  return null; // This component doesn't render anything in React
}
