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

      // Create info window with detailed information - modern glassmorphic design
      const urgencyColor = getMarkerColor(request.urgency);
      const infoContent = `
        <div style="
          background: linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0;
          min-width: 280px;
          max-width: 320px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <!-- Header with gradient background -->
          <div style="
            background: linear-gradient(135deg, ${urgencyColor}40 0%, ${urgencyColor}20 100%);
            border-bottom: 1px solid ${urgencyColor}30;
            padding: 16px;
            position: relative;
            overflow: hidden;
          ">
            <div style="
              position: absolute;
              left: 0;
              top: 0;
              bottom: 0;
              width: 4px;
              background: ${urgencyColor};
              box-shadow: 0 0 12px ${urgencyColor}80;
            "></div>
            <div style="
              font-weight: 700;
              font-size: 15px;
              color: #ffffff;
              margin-bottom: 4px;
              text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            ">
              ${request.urgency.toUpperCase()} - ${request.type.toUpperCase()}
            </div>
            <div style="
              font-size: 12px;
              color: ${urgencyColor};
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ${request.status.replace('_', ' ')}
            </div>
          </div>

          <!-- Content area -->
          <div style="padding: 16px;">
            <!-- Name and People Count -->
            <div style="
              display: flex;
              gap: 12px;
              margin-bottom: 12px;
            ">
              <div style="flex: 1;">
                <div style="
                  font-size: 11px;
                  color: #9ca3af;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">Name</div>
                <div style="
                  font-size: 14px;
                  color: #ffffff;
                  font-weight: 600;
                ">${request.userName}</div>
              </div>
              <div style="
                background: linear-gradient(135deg, ${urgencyColor}30 0%, ${urgencyColor}20 100%);
                border: 1px solid ${urgencyColor}30;
                border-radius: 12px;
                padding: 8px 16px;
                text-align: center;
              ">
                <div style="
                  font-size: 11px;
                  color: #9ca3af;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 2px;
                ">People</div>
                <div style="
                  font-size: 18px;
                  color: ${urgencyColor};
                  font-weight: 700;
                ">${request.peopleCount}</div>
              </div>
            </div>

            ${request.claimedBy ? `
              <div style="
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 8px;
                padding: 8px 12px;
                margin-bottom: 12px;
              ">
                <div style="
                  font-size: 11px;
                  color: #6ee7b7;
                  font-weight: 600;
                  margin-bottom: 2px;
                ">✓ Claimed by</div>
                <div style="
                  font-size: 13px;
                  color: #10b981;
                  font-weight: 600;
                ">${request.claimedBy}</div>
              </div>
            ` : ''}

            <!-- Description -->
            <div style="
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: 8px;
              padding: 10px 12px;
              margin-bottom: 12px;
            ">
              <div style="
                font-size: 13px;
                color: #d1d5db;
                line-height: 1.5;
              ">${request.description}</div>
            </div>

            <!-- Timestamp -->
            <div style="
              font-size: 11px;
              color: #6b7280;
              font-weight: 500;
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              <span style="opacity: 0.6;">⏱</span>
              ${new Date(request.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
        disableAutoPan: true,
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
