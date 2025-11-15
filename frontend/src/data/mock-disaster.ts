import type { DisasterInfo } from '@/types';

// Mock active disasters around the world
export const mockActiveDisasters: DisasterInfo[] = [
  {
    id: 'turkey-eq-2025',
    name: 'Istanbul Earthquake',
    type: 'earthquake',
    date: new Date('2025-02-06'),
    location: 'Istanbul, Turkey',
    center: { lat: 41.0082, lng: 28.9784 },
    boundary: [
      { lat: 41.0200, lng: 28.9600 },
      { lat: 41.0200, lng: 29.0000 },
      { lat: 40.9900, lng: 29.0000 },
      { lat: 40.9900, lng: 28.9600 },
    ],
    severity: 'severe',
    affectedRadius: 50, // km
    isActive: true,
  },
  {
    id: 'florida-hurricane-2025',
    name: 'Hurricane Milton',
    type: 'hurricane',
    date: new Date('2025-03-15'),
    location: 'Miami, Florida, USA',
    center: { lat: 25.7617, lng: -80.1918 },
    boundary: [
      { lat: 26.0000, lng: -80.5000 },
      { lat: 26.0000, lng: -79.9000 },
      { lat: 25.5000, lng: -79.9000 },
      { lat: 25.5000, lng: -80.5000 },
    ],
    severity: 'catastrophic',
    affectedRadius: 100, // km
    isActive: true,
  },
  {
    id: 'japan-tsunami-2025',
    name: 'Sendai Tsunami',
    type: 'tsunami',
    date: new Date('2025-01-20'),
    location: 'Sendai, Japan',
    center: { lat: 38.2682, lng: 140.8694 },
    severity: 'severe',
    affectedRadius: 30, // km
    isActive: true,
  },
  {
    id: 'pakistan-flood-2025',
    name: 'Karachi Floods',
    type: 'flood',
    date: new Date('2025-02-28'),
    location: 'Karachi, Pakistan',
    center: { lat: 24.8607, lng: 67.0011 },
    severity: 'moderate',
    affectedRadius: 40, // km
    isActive: true,
  },
  {
    id: 'london-eq-2025',
    name: 'London Earthquake',
    type: 'earthquake',
    date: new Date('2025-11-15'),
    location: 'London, United Kingdom',
    center: { lat: 51.5074, lng: -0.1278 },
    boundary: [
      { lat: 51.5500, lng: -0.2000 },
      { lat: 51.5500, lng: -0.0500 },
      { lat: 51.4500, lng: -0.0500 },
      { lat: 51.4500, lng: -0.2000 },
    ],
    severity: 'severe',
    affectedRadius: 25, // km
    isActive: true,
  },
];

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Find disasters near a given location
export function findNearbyDisasters(userLat: number, userLng: number): DisasterInfo[] {
  return mockActiveDisasters.filter((disaster) => {
    const distance = calculateDistance(userLat, userLng, disaster.center.lat, disaster.center.lng);
    return distance <= disaster.affectedRadius && disaster.isActive;
  });
}

// Get disaster by ID
export function getDisasterById(id: string): DisasterInfo | undefined {
  return mockActiveDisasters.find((d) => d.id === id);
}

// Default center for when no location is available (middle of world map)
export const defaultCenter = { lat: 20, lng: 0 };
