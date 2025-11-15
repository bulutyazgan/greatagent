import { useEffect } from 'react';
import type { HelpRequest } from '@/types';

interface VictimMarkersProps {
  map: any; // Google Maps Map instance
  helpRequests: HelpRequest[];
  onMarkerClick?: (request: HelpRequest) => void;
}

// Color coding based on urgency
const getMarkerColor = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return '#ef4444'; // Red
    case 'high':
      return '#f59e0b'; // Orange
    case 'medium':
      return '#eab308'; // Yellow
    case 'low':
      return '#10b981'; // Green
    default:
      return '#6b7280'; // Gray
  }
};

export function VictimMarkers({ map, helpRequests, onMarkerClick }: VictimMarkersProps) {
  useEffect(() => {
    if (!map || !window.google) return;

    // Store markers and info windows so we can clean them up
    const markers: any[] = [];
    const infoWindows: any[] = [];

    // Add a marker for each help request
    helpRequests.forEach((request) => {
      const marker = new window.google.maps.Marker({
        position: request.location,
        map: map,
        title: `${request.userName} - ${request.type}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: getMarkerColor(request.urgency),
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: request.urgency === 'critical' ? 12 : 8,
        },
        animation: request.urgency === 'critical' ? window.google.maps.Animation.BOUNCE : undefined,
      });

      // Create info window with detailed information
      const infoContent = `
        <div style="padding: 8px; min-width: 200px; color: #1a1a1a;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: ${getMarkerColor(request.urgency)};">
            ${request.urgency.toUpperCase()} - ${request.type.toUpperCase()}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Name:</strong> ${request.userName}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>People:</strong> ${request.peopleCount}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Status:</strong> ${request.status.replace('_', ' ').toUpperCase()}
          </div>
          ${request.claimedBy ? `<div style="margin-bottom: 4px;"><strong>Claimed by:</strong> ${request.claimedBy}</div>` : ''}
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            ${request.description}
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #999;">
            ${new Date(request.createdAt).toLocaleString()}
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
      });

      // Show info window on hover
      marker.addListener('mouseover', () => {
        infoWindow.open(map, marker);
      });

      // Hide info window when mouse leaves
      marker.addListener('mouseout', () => {
        infoWindow.close();
      });

      // Add click listener
      marker.addListener('click', () => {
        if (onMarkerClick) {
          onMarkerClick(request);
        }
      });

      markers.push(marker);
      infoWindows.push(infoWindow);
    });

    // Cleanup function to remove markers and info windows when component unmounts or dependencies change
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      infoWindows.forEach((infoWindow) => infoWindow.close());
    };
  }, [map, helpRequests, onMarkerClick]);

  return null; // This component doesn't render anything in React
}
