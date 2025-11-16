import { useEffect, useRef } from 'react';
import type { HelpRequest } from '@/types';

interface VictimMarkersProps {
  map: any; // Google Maps Map instance
  helpRequests: HelpRequest[];
  onMarkerClick?: (request: HelpRequest) => void;
}

// Color coding based on urgency - DARK RED for critical, ORANGE for high, BRIGHT YELLOW for medium/low
const getCircleColors = (urgency: string) => {
  switch (urgency) {
    case 'critical':
      return {
        strokeColor: '#5A1810',  // MUCH DARKER red-brown (nearly black-red)
        fillColor: '#8B2420',    // Dark red
        strokeOpacity: 1.0,
        fillOpacity: 0.55,       // More opaque for visibility
      };
    case 'high':
      return {
        strokeColor: '#A25C41',  // alert-dark (darker orange)
        fillColor: '#D97A4A',    // Bright orange-terracotta
        strokeOpacity: 0.95,
        fillOpacity: 0.5,
      };
    case 'medium':
      return {
        strokeColor: '#D4A840',  // BRIGHTER golden
        fillColor: '#FFD15C',    // BRIGHT golden yellow
        strokeOpacity: 0.9,
        fillOpacity: 0.45,
      };
    case 'low':
      return {
        strokeColor: '#E0B84A',  // BRIGHTER yellow
        fillColor: '#FFED4E',    // VERY BRIGHT yellow
        strokeOpacity: 0.85,
        fillOpacity: 0.4,
      };
    default:
      return {
        strokeColor: '#6E5F4E',  // neutral-600
        fillColor: '#8A7866',    // neutral-500
        strokeOpacity: 0.7,
        fillOpacity: 0.35,
      };
  }
};

// Get radius based on urgency and people count - LARGER and more distinct
const getCircleRadius = (urgency: string, peopleCount: number): number => {
  const baseRadius = Math.max(50, Math.min(peopleCount * 15, 120)); // 50-120m base (increased)

  const urgencyMultiplier = {
    'critical': 1.8,  // Much larger for critical
    'high': 1.5,      // Larger for high
    'medium': 1.2,    // Slightly larger
    'low': 1.0,
  }[urgency] || 1.0;

  return baseRadius * urgencyMultiplier;
};

// Helper function to add pulsing animation to critical circles
const addPulsingAnimation = (circle: any, colors: any) => {
  let growing = true;
  let currentOpacity = colors.fillOpacity;

  const pulse = () => {
    if (growing) {
      currentOpacity += 0.05;
      if (currentOpacity >= colors.fillOpacity + 0.2) {
        growing = false;
      }
    } else {
      currentOpacity -= 0.05;
      if (currentOpacity <= colors.fillOpacity - 0.1) {
        growing = true;
      }
    }
    circle.setOptions({ fillOpacity: currentOpacity });
  };

  const interval = setInterval(pulse, 100);
  return () => clearInterval(interval);
};

export function VictimMarkers({ map, helpRequests, onMarkerClick }: VictimMarkersProps) {
  const circlesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing circles, markers, info windows, and animations
    circlesRef.current.forEach(circle => circle.setMap(null));
    markersRef.current.forEach(marker => marker.setMap(null));
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());

    circlesRef.current = [];
    markersRef.current = [];
    infoWindowsRef.current = [];
    cleanupFunctionsRef.current = [];

    // Add a circle for each help request
    helpRequests.forEach((request) => {
      const colors = getCircleColors(request.urgency);
      const radius = getCircleRadius(request.urgency, request.peopleCount);

      const circle = new window.google.maps.Circle({
        center: request.location,
        radius: radius,
        fillColor: colors.fillColor,
        fillOpacity: colors.fillOpacity,
        strokeWeight: 0,  // NO BORDER
        map: map,
        clickable: false,  // Only pins are interactive
        zIndex: 2,  // Above polygons
      });

      // Create custom image marker using OverlayView for HTML content
      class CustomVictimMarker extends window.google.maps.OverlayView {
        position: any;
        containerDiv: HTMLDivElement | null = null;
        borderColor: string;
        onHoverEnter: () => void;
        onHoverLeave: () => void;
        onClick: () => void;

        constructor(
          position: any,
          borderColor: string,
          onHoverEnter: () => void,
          onHoverLeave: () => void,
          onClick: () => void
        ) {
          super();
          this.position = position;
          this.borderColor = borderColor;
          this.onHoverEnter = onHoverEnter;
          this.onHoverLeave = onHoverLeave;
          this.onClick = onClick;
        }

        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.cursor = 'pointer';

          div.innerHTML = `
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 3px solid ${this.borderColor};
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

          // Add event listeners
          div.addEventListener('mouseenter', this.onHoverEnter);
          div.addEventListener('mouseleave', this.onHoverLeave);
          div.addEventListener('click', this.onClick);

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
            this.containerDiv.style.left = (position.x - 20) + 'px';  // Center horizontally (40px / 2)
            this.containerDiv.style.top = (position.y - 20) + 'px';   // Center vertically (40px / 2)
          }
        }

        onRemove() {
          if (this.containerDiv) {
            this.containerDiv.removeEventListener('mouseenter', this.onHoverEnter);
            this.containerDiv.removeEventListener('mouseleave', this.onHoverLeave);
            this.containerDiv.removeEventListener('click', this.onClick);
            this.containerDiv.parentNode?.removeChild(this.containerDiv);
            this.containerDiv = null;
          }
        }
      }

      const customMarker = new CustomVictimMarker(
        request.location,
        colors.strokeColor,
        () => {
          circle.setOptions({
            fillOpacity: colors.fillOpacity + 0.2,
          });
          infoWindow.setPosition(request.location);
          infoWindow.open(map);
        },
        () => {
          circle.setOptions({
            fillOpacity: colors.fillOpacity,
          });
          infoWindow.close();
        },
        () => {
          if (onMarkerClick) {
            onMarkerClick(request);
          }
        }
      );
      customMarker.setMap(map);

      // Add pulsing animation for critical urgency
      if (request.urgency === 'critical') {
        const cleanup = addPulsingAnimation(circle, colors);
        cleanupFunctionsRef.current.push(cleanup);
      }

      // Create info window with detailed information
      const urgencyColor = colors.strokeColor;
      const infoContent = `
        <div style="
          background: linear-gradient(135deg, rgba(42, 32, 25, 0.95) 0%, rgba(61, 49, 40, 0.98) 100%);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(196, 181, 163, 0.2);
          padding: 0;
          min-width: 280px;
          max-width: 320px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(196, 181, 163, 0.1);
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
              color: #F5F1EB;
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
                  color: #A69583;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">Name</div>
                <div style="
                  font-size: 14px;
                  color: #F5F1EB;
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
                  color: #A69583;
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
                background: linear-gradient(135deg, rgba(139, 155, 122, 0.2) 0%, rgba(139, 155, 122, 0.1) 100%);
                border: 1px solid rgba(139, 155, 122, 0.3);
                border-radius: 8px;
                padding: 8px 12px;
                margin-bottom: 12px;
              ">
                <div style="
                  font-size: 11px;
                  color: #A8B599;
                  font-weight: 600;
                  margin-bottom: 2px;
                ">✓ Claimed by</div>
                <div style="
                  font-size: 13px;
                  color: #8B9B7A;
                  font-weight: 600;
                ">${request.claimedBy}</div>
              </div>
            ` : ''}

            <!-- Description -->
            <div style="
              background: rgba(196, 181, 163, 0.05);
              border: 1px solid rgba(196, 181, 163, 0.1);
              border-radius: 8px;
              padding: 10px 12px;
              margin-bottom: 12px;
            ">
              <div style="
                font-size: 13px;
                color: #D9CFC0;
                line-height: 1.5;
              ">${request.description}</div>
            </div>

            <!-- Timestamp -->
            <div style="
              font-size: 11px;
              color: #8A7866;
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
        pixelOffset: new window.google.maps.Size(0, -50),  // 50 pixels above marker
      });

      circlesRef.current.push(circle);
      markersRef.current.push(customMarker);
      infoWindowsRef.current.push(infoWindow);
    });

    // Cleanup function
    return () => {
      circlesRef.current.forEach(circle => circle.setMap(null));
      markersRef.current.forEach(marker => marker.setMap(null));
      infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    };
  }, [map, helpRequests, onMarkerClick]);

  return null; // This component renders directly to the map
}
