// Clean satellite/hybrid theme - ONLY show district/borough/city names
export const cleanHybridTheme: any[] = [
  // Hide ALL road labels (street names)
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },

  // Hide ALL POIs (landmarks, tube stations, restaurants, shops, etc.)
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },

  // Hide transit labels (subway/metro stations, bus stops, etc.)
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },

  // SHOW ONLY administrative area labels (districts, boroughs, cities)
  {
    featureType: "administrative.locality",  // Cities and towns
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "administrative.neighborhood",  // Neighborhoods and districts
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },

  // Hide water labels (river names, lake names, etc.)
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },

  // Hide landscape/park labels
  {
    featureType: "landscape",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

// Map options for disaster zone - TERRAIN mode with bright, natural colors
export const defaultMapOptions: any = {
  disableDefaultUI: true,         // Disables ALL default controls
  zoomControl: false,             // No zoom buttons (+/-)
  mapTypeControl: false,          // No map/satellite toggle
  streetViewControl: false,       // No street view pegman
  fullscreenControl: false,       // No fullscreen button
  scaleControl: false,            // No scale indicator
  rotateControl: false,           // No rotation control
  clickableIcons: false,          // Icons not clickable
  gestureHandling: 'greedy',      // Allow scrolling without Ctrl
  keyboardShortcuts: false,       // Disable keyboard shortcuts UI
};
