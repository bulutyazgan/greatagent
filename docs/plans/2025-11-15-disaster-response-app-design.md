# Natural Disaster Emergency Response App - Design Document

**Date:** 2025-11-15
**Status:** Approved

## Overview

A location-aware emergency response web application for civilians affected by major natural disasters (earthquakes, hurricanes, tsunamis, floods). The app auto-detects when users are in an active disaster zone and provides an interactive map centered on their immediate area, allowing them to request help, view nearby emergency resources, and receive live updates.

## Core Concept

This is a **region-specific emergency response app** that gets deployed for specific disaster events. When a disaster occurs (e.g., earthquake in Turkey), civilians in the affected area use the app to:
- Request help with their specific needs
- See nearby help requests from others
- Locate emergency resources (shelters, hospitals, water stations)
- Receive official updates and alerts
- Navigate the disaster zone safely

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Radix UI** primitives (Dialog, Sheet, Tabs, Toast)
- **Shadcn/UI** components built on Radix
- **Google Maps JavaScript API** for interactive mapping
- **Lucide React** for icons

## User Flow

1. User opens app → Auto-detects GPS location
2. If in disaster zone → Shows map centered on user's neighborhood (zoom ~15)
3. Map loads with:
   - User location marker (pulsing blue)
   - Nearby help request pins (color-coded by urgency)
   - Emergency resource markers (green)
   - Disaster zone boundary (polygon overlay)
4. Persistent "Request Help" FAB (bottom-right) always visible
5. Left slide-in panel (collapsible) with tabs: Alerts, News, Help Feed, Resources
6. Users can zoom/pan map, click pins for details, search locations, toggle layers

## Map System (Google Maps API)

### Configuration
- **API:** Google Maps JavaScript API with custom dark theme
- **Initial View:** User's GPS location, zoom level 15 (neighborhood detail)
- **Map Type:** Hybrid (satellite + street labels)
- **Styling:** Dark theme, desaturated colors to emphasize markers

### Map Elements

**User Location:**
- Pulsing blue marker with circular radius showing immediate area

**Help Request Markers:**
- Custom SVG markers with icon badges (medical, food, shelter, rescue, other)
- Color-coded by urgency:
  - Red: Critical
  - Orange: Urgent
  - Yellow: Standard
- Marker clustering for dense areas (Google Maps MarkerClusterer)

**Emergency Resources:**
- Green custom markers for:
  - Hospitals/Medical centers
  - Emergency shelters
  - Water distribution points
  - Safe zones

**Disaster Zone Boundary:**
- Polygon overlay with subtle red tint and glowing border
- Shows full extent of affected area

### Interactions
- Click marker → Opens detail sheet from right side
- Hover marker → Info window with type, urgency, distance
- Search → Google Places API autocomplete, smooth pan/zoom
- Layer toggles → Show/hide different marker types
- Get Directions → Route to selected location

## UI Layout & Components

### Main Layout (Globe-Primary Approach)

**3D Map Canvas:**
- Full viewport background (100vw × 100vh)
- Google Maps container with custom dark theme

**Top Bar (Fixed):**
- Glassmorphic header
- App logo
- Current disaster info chip (e.g., "Turkey Earthquake • Feb 6")
- Location search with autocomplete
- Settings icon

**Request Help FAB:**
- Bottom-right floating action button
- Always visible, high z-index
- Glassmorphic with red accent glow
- Opens Dialog modal on click

**Left Slide Panel (Sheet):**
- Collapsible (default closed on mobile)
- Toggle button on left edge
- Contains tabs: Alerts, News, Help Feed, Resources
- Glassmorphic background with backdrop blur

**Right Detail Panel (Sheet):**
- Slides in when clicking map markers
- Shows detailed information about selected item
- Action buttons (Get Directions, Respond, Close)

### Key Components (Shadcn/Radix)

- **Sheet:** Left panel and right detail drawer
- **Dialog:** Request Help form modal
- **Tabs:** Content switching in left panel
- **Card:** News items, help requests, resource listings
- **Badge:** Urgency levels, status indicators
- **Button:** Glassmorphic variants
- **Toast:** Notifications
- **Select/Combobox:** Filters, location search

### Responsive Behavior
- **Desktop:** Left panel can stay open, map adjusts width
- **Mobile:** Panels overlay map completely, swipe to dismiss

## Theme & Styling

### Color Palette (Sleek Minimal + Glassmorphism)

**Backgrounds:**
- Primary: `#0a0a0a` (deep black)
- Secondary: `#171717` (soft black)
- Elevated: `#1f1f1f` (card backgrounds)

**Glassmorphic Panels:**
- Background: `rgba(23, 23, 23, 0.7)`
- Backdrop blur: 24px
- Border: `1px solid rgba(255, 255, 255, 0.1)`

**Accents:**
- Primary (blue): `#3b82f6` - user location, links
- Success (green): `#10b981` - resources, safe zones
- Warning (orange): `#f59e0b` - urgent help
- Danger (red): `#ef4444` - critical help, alerts
- Purple glow: `#a855f7` - subtle highlights, focus states

### Typography
- **Primary Font:** Inter (sans-serif)
- **Mono Font:** JetBrains Mono (timestamps, coordinates, IDs)

### Component Styling
- Buttons: 8px border radius, subtle shadows, hover glow
- Cards: Glassmorphic, 1px border, 12px border radius
- Inputs: Dark background, subtle border, blue focus ring with glow
- Sheets/Dialogs: Glassmorphic overlay, smooth slide animations

## Core Features

### 1. Request Help

**Trigger:** Click FAB → Opens Dialog modal

**Form Fields:**
- Help Type (select): Medical Emergency, Food/Water, Shelter, Rescue, Other
- Urgency (radio): Critical, Urgent, Standard
- Number of People (number input)
- Description (textarea, optional)
- Location (auto-filled from GPS, adjustable on map)

**Submission:**
- Creates marker on map
- Adds to help requests feed
- Stores in localStorage (mock backend)
- Shows Toast confirmation with request ID

### 2. Help Requests Feed (Left Panel Tab)

Scrollable list of Cards showing:
- Help type icon and urgency badge
- Distance from user (calculated)
- Time posted (relative: "5 mins ago")
- Number of people affected
- Brief description (truncated)
- "View on Map" button (pans to marker)

### 3. News/Updates Tab (Left Panel)

Timeline of disaster updates:
- Official alerts (aftershocks, evacuation orders)
- Relief organization announcements
- Safety advisories

Each update includes:
- Timestamp
- Source
- Severity badge
- Full description

### 4. Emergency Resources Tab (Left Panel)

Filterable list of nearby resources:
- Hospitals/Medical centers
- Emergency shelters
- Water distribution points
- Safe zones

Each resource shows:
- Type icon
- Name
- Distance from user
- Capacity status (if available)
- "Get Directions" button

### 5. Alerts Tab (Left Panel)

High-priority notifications:
- Immediate danger warnings
- Evacuation notices
- Critical system updates

## Project Structure

```
greatagent/
├── src/
│   ├── components/
│   │   ├── ui/              # Shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   ├── map/             # Map-related components
│   │   │   ├── MapContainer.tsx
│   │   │   ├── CustomMarker.tsx
│   │   │   ├── MarkerCluster.tsx
│   │   │   └── DisasterBoundary.tsx
│   │   ├── panels/
│   │   │   ├── LeftPanel.tsx
│   │   │   ├── DetailPanel.tsx
│   │   │   ├── RequestHelpDialog.tsx
│   │   │   ├── HelpFeedTab.tsx
│   │   │   ├── NewsTab.tsx
│   │   │   ├── ResourcesTab.tsx
│   │   │   └── AlertsTab.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── RequestHelpFAB.tsx
│   ├── lib/
│   │   ├── utils.ts         # Tailwind cn(), etc.
│   │   └── maps.ts          # Google Maps utilities
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   └── useMapMarkers.ts
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── styles/
│   │   └── map-theme.ts     # Google Maps dark theme config
│   ├── data/
│   │   ├── mock-news.ts
│   │   ├── mock-resources.ts
│   │   └── mock-alerts.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── markers/             # Custom marker SVGs
├── tailwind.config.js
├── components.json          # Shadcn config
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## Key Type Definitions

```typescript
type HelpRequestType = 'medical' | 'food' | 'shelter' | 'rescue' | 'other'
type Urgency = 'critical' | 'urgent' | 'standard'
type ResourceType = 'hospital' | 'shelter' | 'water' | 'safe-zone'

interface HelpRequest {
  id: string
  type: HelpRequestType
  urgency: Urgency
  location: { lat: number; lng: number }
  peopleCount: number
  description?: string
  timestamp: Date
  status: 'active' | 'responding' | 'resolved'
}

interface EmergencyResource {
  id: string
  type: ResourceType
  name: string
  location: { lat: number; lng: number }
  capacity?: number
  currentOccupancy?: number
  contact?: string
}

interface NewsUpdate {
  id: string
  title: string
  content: string
  source: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: Date
}

interface Alert {
  id: string
  title: string
  message: string
  severity: 'warning' | 'critical'
  timestamp: Date
  expiresAt?: Date
}
```

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@googlemaps/js-api-loader": "^1.16.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.344.0",
    "date-fns": "^3.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@types/google.maps": "^3.55.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.0",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35"
  }
}
```

## Mock Data Approach

Since there's no backend yet:
- **Help Requests:** Local state (useState/useReducer) + localStorage
- **News Updates:** Mock data file with sample updates
- **Emergency Resources:** Mock data file with sample locations
- **Alerts:** Mock data file with sample alerts
- **Geolocation:** Browser Geolocation API (with override for testing)

## Implementation Priorities

1. **Phase 1: Project Setup**
   - Initialize Vite + React + TypeScript
   - Configure Tailwind with custom theme
   - Set up Shadcn/UI components
   - Install Google Maps dependencies

2. **Phase 2: Core Map**
   - Implement MapContainer with Google Maps
   - Add user location detection and marker
   - Create custom marker components
   - Apply dark theme styling

3. **Phase 3: UI Layout**
   - Build Header component
   - Create Request Help FAB
   - Implement left slide panel (Sheet)
   - Build right detail panel (Sheet)

4. **Phase 4: Core Features**
   - Request Help dialog and form
   - Help Requests feed with mock data
   - Emergency Resources tab
   - News/Updates tab
   - Alerts tab

5. **Phase 5: Map Interactions**
   - Marker clustering
   - Click handlers for details
   - Search/autocomplete
   - Layer toggles
   - Directions integration

6. **Phase 6: Polish**
   - Responsive design refinement
   - Animations and transitions
   - Toast notifications
   - Loading states
   - Error handling

## Success Criteria

- App loads and detects user location
- Map displays with dark theme styling
- User can create help requests
- Help requests appear as markers on map
- Panels slide in/out smoothly
- All tabs show relevant mock data
- Responsive on mobile and desktop
- Glassmorphic theme applied consistently
