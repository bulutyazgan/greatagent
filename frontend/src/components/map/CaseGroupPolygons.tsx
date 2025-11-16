import { useEffect, useRef } from 'react';
import type { Location } from '@/types';

export interface CaseGroup {
  id: string;
  name: string;
  boundary: Location[];  // Array of lat/lng points forming the polygon
  caseCount: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface CaseGroupPolygonsProps {
  map: any;
  caseGroups: CaseGroup[];
  onPolygonClick?: (caseGroup: CaseGroup) => void;
}

// Color mapping based on urgency
const getPolygonColors = (urgency: CaseGroup['urgency']) => {
  switch (urgency) {
    case 'critical':
      return {
        strokeColor: '#A25C41',  // alert-dark
        fillColor: '#C17A5B',    // alert
        strokeOpacity: 0.9,
        fillOpacity: 0.25,
      };
    case 'high':
      return {
        strokeColor: '#C17A5B',  // alert
        fillColor: '#D99B82',    // alert-light
        strokeOpacity: 0.8,
        fillOpacity: 0.2,
      };
    case 'medium':
      return {
        strokeColor: '#8B9B7A',  // secondary
        fillColor: '#A8B599',    // secondary-light
        strokeOpacity: 0.7,
        fillOpacity: 0.15,
      };
    case 'low':
      return {
        strokeColor: '#6D7D5C',  // secondary-dark
        fillColor: '#8B9B7A',    // secondary
        strokeOpacity: 0.6,
        fillOpacity: 0.1,
      };
  }
};

export function CaseGroupPolygons({ map, caseGroups, onPolygonClick }: CaseGroupPolygonsProps) {
  const polygonsRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing polygons and info windows
    polygonsRef.current.forEach(polygon => polygon.setMap(null));
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
    polygonsRef.current = [];
    infoWindowsRef.current = [];

    // Create new polygons for each case group
    caseGroups.forEach(caseGroup => {
      const colors = getPolygonColors(caseGroup.urgency);

      const polygon = new window.google.maps.Polygon({
        paths: caseGroup.boundary,
        ...colors,
        strokeWeight: 3,
        map: map,
        clickable: !!onPolygonClick,
        zIndex: 1,  // Below markers
      });

      // Calculate center of polygon for info window positioning
      const bounds = new window.google.maps.LatLngBounds();
      caseGroup.boundary.forEach(point => bounds.extend(point));
      const center = bounds.getCenter();

      // Create info window with aggregate information
      const urgencyColor = colors.strokeColor;
      const infoContent = `
        <div style="
          background: linear-gradient(135deg, rgba(42, 32, 25, 0.95) 0%, rgba(61, 49, 40, 0.98) 100%);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(196, 181, 163, 0.2);
          padding: 0;
          min-width: 260px;
          max-width: 300px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(196, 181, 163, 0.1);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <!-- Header -->
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
              font-size: 14px;
              color: #F5F1EB;
              margin-bottom: 4px;
              text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            ">
              ${caseGroup.name}
            </div>
            <div style="
              font-size: 11px;
              color: ${urgencyColor};
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ZONE - ${caseGroup.urgency.toUpperCase()} URGENCY
            </div>
          </div>

          <!-- Content area -->
          <div style="padding: 16px;">
            <!-- Case Count -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            ">
              <div style="
                background: linear-gradient(135deg, ${urgencyColor}30 0%, ${urgencyColor}20 100%);
                border: 1px solid ${urgencyColor}30;
                border-radius: 12px;
                padding: 12px 16px;
                text-align: center;
                flex: 1;
              ">
                <div style="
                  font-size: 11px;
                  color: #A69583;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">Active Cases</div>
                <div style="
                  font-size: 24px;
                  color: ${urgencyColor};
                  font-weight: 700;
                ">${caseGroup.caseCount}</div>
              </div>
            </div>

            <!-- Zone Info -->
            <div style="
              background: rgba(196, 181, 163, 0.05);
              border: 1px solid rgba(196, 181, 163, 0.1);
              border-radius: 8px;
              padding: 10px 12px;
            ">
              <div style="
                font-size: 12px;
                color: #D9CFC0;
                line-height: 1.5;
              ">
                <div style="margin-bottom: 4px;">
                  <span style="color: #A69583; font-weight: 600;">Danger Level:</span>
                  <span style="color: ${urgencyColor}; font-weight: 700; margin-left: 6px;">${caseGroup.urgency.toUpperCase()}</span>
                </div>
                <div style="color: #8A7866; font-size: 11px; margin-top: 6px;">
                  Click for detailed case breakdown
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
        position: center,
        disableAutoPan: true,
      });

      // Add click listener
      if (onPolygonClick) {
        polygon.addListener('click', () => {
          onPolygonClick(caseGroup);
        });
      }

      // Add hover effect with info window
      polygon.addListener('mouseover', () => {
        polygon.setOptions({
          fillOpacity: colors.fillOpacity + 0.1,
          strokeWeight: 4,
        });
        infoWindow.open(map);
      });

      polygon.addListener('mouseout', () => {
        polygon.setOptions({
          fillOpacity: colors.fillOpacity,
          strokeWeight: 3,
        });
        infoWindow.close();
      });

      polygonsRef.current.push(polygon);
      infoWindowsRef.current.push(infoWindow);
    });

    // Cleanup function
    return () => {
      polygonsRef.current.forEach(polygon => polygon.setMap(null));
      infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
      polygonsRef.current = [];
      infoWindowsRef.current = [];
    };
  }, [map, caseGroups, onPolygonClick]);

  return null;  // This component renders directly to the map
}
