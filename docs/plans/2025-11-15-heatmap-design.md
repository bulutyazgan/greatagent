# Heatmap Feature Design

**Date:** 2025-11-15
**Feature:** Help Request Density Heatmap

## Overview

Implement a toggleable heatmap overlay on the Google Maps interface to visualize areas with higher concentrations of help requests. The heatmap will weight data points based on both the number of people in each request and the urgency level.

## Architecture & Data Flow

### Component Structure
- **New Component:** `HeatmapLayer.tsx` - Manages Google Maps Heatmap visualization
- **UI Control:** Toggle button in map controls area
- **Integration Point:** `MapContainer.tsx` coordinates between victim markers and heatmap

### Data Flow
1. `Dashboard`/`App` passes `helpRequests` prop to `MapContainer`
2. `MapContainer` passes filtered help requests to both `VictimMarkers` and `HeatmapLayer`
3. `HeatmapLayer` transforms help requests into weighted heatmap data points
4. Toggle state managed in `MapContainer` to show/hide the heatmap layer

### Weight Calculation Strategy
Each help request is converted to weighted points using:
- **Base weight:** `peopleCount`
- **Urgency multipliers:**
  - `critical = 3x`
  - `high = 2x`
  - `medium = 1.5x`
  - `low = 1x`
- **Final weight:** `peopleCount × urgencyMultiplier`

**Example:**
- Critical request with 5 people = weight of 15
- Low urgency request with 10 people = weight of 10

## Google Maps Heatmap Integration

### API Setup
- Load `visualization` library alongside existing `maps` library
- Use `importLibrary('visualization')` to access `google.maps.visualization.HeatmapLayer`

### Heatmap Configuration
- **Data points:** Array of `google.maps.visualization.WeightedLocation` objects
  - Each point: `{ location: LatLng, weight: number }`
- **Gradient:** Red-based default gradient (traditional emergency visualization)
- **Radius:** 30-50 pixels (controls spread of each point)
- **Opacity:** 0.6-0.7 (ensures markers remain visible)
- **Max intensity:** Auto-calculate based on maximum weight

### Data Transformation
```typescript
const heatmapData = helpRequests.map(request => {
  const urgencyMultiplier = {
    critical: 3,
    high: 2,
    medium: 1.5,
    low: 1
  }[request.urgency];

  return {
    location: new google.maps.LatLng(request.location.lat, request.location.lng),
    weight: request.peopleCount * urgencyMultiplier
  };
});
```

## UI Controls & Filter Integration

### Toggle Button
- **Position:** Top-right area of map (below existing controls)
- **Design:** Glassmorphic style matching existing UI (`glass` class)
- **Colors:** Blue accent colors from app theme
- **States:** "Show Heatmap" / "Hide Heatmap" with visual indicator
- **Default:** Hidden (off)

### Filter Integration
- Heatmap responds to same filters as victim markers
- Receives filtered `helpRequests` array
- Re-calculates weighted points on prop changes
- Updates in real-time using `heatmap.setData(newWeightedPoints)`

### State Management
- `showHeatmap` boolean state in `MapContainer` (defaults to `false`)
- **Toggle on:** Create heatmap layer and add to map
- **Toggle off:** Call `heatmap.setMap(null)` to remove from display
- Heatmap instance preserved while hidden for performance

### Edge Cases
- **Empty requests:** Hide heatmap automatically
- **Single request:** Display with appropriate radius
- **Co-located requests:** Show single concentrated hotspot

## Implementation Files

### New Files
- `frontend/src/components/map/HeatmapLayer.tsx` - Heatmap visualization component
- `frontend/src/components/map/HeatmapToggle.tsx` - Toggle button component

### Modified Files
- `frontend/src/components/map/MapContainer.tsx` - Add heatmap integration and toggle state
- `frontend/src/types/google-maps.d.ts` - Add TypeScript definitions for visualization library (if needed)

## Success Criteria
- Heatmap accurately represents help request density
- Weight calculation properly combines people count and urgency
- Toggle button smoothly shows/hides heatmap
- Heatmap updates when filters are applied
- Visual consistency with existing glassmorphic UI
- No performance degradation with 100+ help requests
