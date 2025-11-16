import { useEffect, useRef } from 'react';
import type { Location, UserRole } from '@/types';

interface UserLocationMarkerProps {
  map: any; // Google Maps Map instance
  userLocation: Location | null;
  userRole?: UserRole; // Optional: to display different icons for helpers
}

export function UserLocationMarker({ map, userLocation, userRole }: UserLocationMarkerProps) {
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  // Create marker once when map is ready
  useEffect(() => {
    if (!map || !window.google) return;

    // For helpers, use custom image marker with circle border and "You" pill
    if (userRole === 'responder') {
      // Create a custom marker using OverlayView for HTML content
      class CustomMarker extends window.google.maps.OverlayView {
        position: any;
        containerDiv: HTMLDivElement | null = null;

        constructor(position: any) {
          super();
          this.position = position;
        }

        setPosition(newPosition: any) {
          this.position = newPosition;
          this.draw();
        }

        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.cursor = 'pointer';
          div.style.zIndex = '1000';  // Ensure it's above all victim markers

          div.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <!-- Image without border -->
              <div style="
                width: 50px;
                height: 50px;
                border-radius: 50%;
                overflow: hidden;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
                background: white;
                padding: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 4px;
              ">
                <img src="/assets/helpful.png" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>

              <!-- "You" pill below -->
              <div style="
                background: linear-gradient(135deg, #A67C52 0%, #8B5E34 100%);
                color: #F5F1EB;
                font-size: 11px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(245, 241, 235, 0.3);
                white-space: nowrap;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              ">You</div>
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
            this.containerDiv.style.left = (position.x - 25) + 'px';  // Center horizontally (50px / 2)
            this.containerDiv.style.top = (position.y - 60) + 'px';   // Position above point (image + pill height)
          }
        }

        onRemove() {
          if (this.containerDiv) {
            this.containerDiv.parentNode?.removeChild(this.containerDiv);
            this.containerDiv = null;
          }
        }
      }

      const customMarker = new CustomMarker(userLocation || { lat: 0, lng: 0 });
      customMarker.setMap(map);
      markerRef.current = customMarker;

      // Cleanup
      return () => {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
      };
    }

    // For victims (or no role), use the blue circle marker
    const marker = new window.google.maps.Marker({
      position: userLocation || { lat: 0, lng: 0 },
      map: map,
      title: 'Your Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#3b82f6', // Blue color
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 10,
      },
      zIndex: 1000, // Ensure it appears on top of other markers
    });

    // Create a pulsing circle effect around the user marker
    const pulseCircle = new window.google.maps.Circle({
      map: map,
      center: userLocation || { lat: 0, lng: 0 },
      radius: 50, // 50 meters radius
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.4,
      strokeWeight: 2,
      zIndex: 999,
    });

    markerRef.current = marker;
    circleRef.current = pulseCircle;

    // Create info window for user location
    const infoContent = `
      <div style="
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.98) 100%);
        backdrop-filter: blur(20px);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 12px 16px;
        min-width: 180px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          font-weight: 700;
          font-size: 14px;
          color: #ffffff;
          text-align: center;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        ">
          📍 Your Location
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

    // Cleanup function to remove marker, circle, and info window
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      infoWindow.close();
    };
  }, [map, userRole]);

  // Update marker position when location changes
  useEffect(() => {
    if (!userLocation || !markerRef.current) return;

    if (userRole === 'responder') {
      // Update custom marker position
      if (markerRef.current.setPosition) {
        markerRef.current.setPosition(userLocation);
      }
    } else {
      // Update standard marker position
      if (markerRef.current.setPosition) {
        markerRef.current.setPosition(userLocation);
      }
      // Update circle center
      if (circleRef.current) {
        circleRef.current.setCenter(userLocation);
      }
    }
  }, [userLocation, userRole]);

  return null; // This component doesn't render anything in React
}
