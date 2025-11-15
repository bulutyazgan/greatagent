// Dark theme with roads visible but no labels/text
export const darkMapTheme: any[] = [
  // Base map - dark background
  {
    elementType: "geometry",
    stylers: [{ color: "#1a1a1a" }],
  },
  // Hide ALL labels (road names, place names, etc.)
  {
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  // Hide all POIs (airports, shops, restaurants, etc.)
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  // Show roads but hide their labels
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2b2b2b" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  // Highways slightly lighter
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3d3d3d" }],
  },
  // Hide transit (subway, airport icons, etc.)
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  // Show water for geographic context
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f1e2e" }],
  },
  // Show parks/green spaces
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#1a1a1a" }],
  },
  // Hide administrative labels but keep boundaries subtle
  {
    featureType: "administrative",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

// Map options for disaster zone
export const defaultMapOptions: any = {
  styles: darkMapTheme,
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
};
