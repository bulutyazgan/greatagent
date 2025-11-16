import type { CaseGroup } from '@/components/map/CaseGroupPolygons';

// Mock case groups for the London earthquake disaster
// These represent logical groupings of related cases (e.g., same building, same neighborhood)
export const mockCaseGroups: CaseGroup[] = [
  {
    id: 'cg-1',
    name: 'Tower Bridge Area - North Side',
    caseCount: 8,
    urgency: 'critical',
    boundary: [
      { lat: 51.5078, lng: -0.0755 },  // Northwest corner
      { lat: 51.5078, lng: -0.0735 },  // Northeast corner
      { lat: 51.5068, lng: -0.0735 },  // Southeast corner
      { lat: 51.5068, lng: -0.0755 },  // Southwest corner
    ],
  },
  {
    id: 'cg-2',
    name: 'Shoreditch High Street - Collapsed Building',
    caseCount: 12,
    urgency: 'high',
    boundary: [
      { lat: 51.5245, lng: -0.0785 },
      { lat: 51.5245, lng: -0.0765 },
      { lat: 51.5235, lng: -0.0765 },
      { lat: 51.5235, lng: -0.0785 },
    ],
  },
  {
    id: 'cg-3',
    name: 'Liverpool Street Station',
    caseCount: 25,
    urgency: 'critical',
    boundary: [
      { lat: 51.5180, lng: -0.0825 },
      { lat: 51.5180, lng: -0.0795 },
      { lat: 51.5170, lng: -0.0795 },
      { lat: 51.5170, lng: -0.0825 },
    ],
  },
  {
    id: 'cg-4',
    name: 'Brick Lane Market Area',
    caseCount: 6,
    urgency: 'medium',
    boundary: [
      { lat: 51.5220, lng: -0.0720 },
      { lat: 51.5220, lng: -0.0700 },
      { lat: 51.5210, lng: -0.0700 },
      { lat: 51.5210, lng: -0.0720 },
    ],
  },
  {
    id: 'cg-5',
    name: 'Bethnal Green - Gas Leak Zone',
    caseCount: 15,
    urgency: 'high',
    boundary: [
      { lat: 51.5275, lng: -0.0570 },
      { lat: 51.5275, lng: -0.0540 },
      { lat: 51.5260, lng: -0.0540 },
      { lat: 51.5260, lng: -0.0570 },
    ],
  },
  {
    id: 'cg-6',
    name: 'Whitechapel Road - Structural Damage',
    caseCount: 9,
    urgency: 'medium',
    boundary: [
      { lat: 51.5190, lng: -0.0650 },
      { lat: 51.5190, lng: -0.0620 },
      { lat: 51.5175, lng: -0.0620 },
      { lat: 51.5175, lng: -0.0650 },
    ],
  },
  {
    id: 'cg-7',
    name: 'Aldgate East Underground',
    caseCount: 20,
    urgency: 'critical',
    boundary: [
      { lat: 51.5155, lng: -0.0725 },
      { lat: 51.5155, lng: -0.0705 },
      { lat: 51.5145, lng: -0.0705 },
      { lat: 51.5145, lng: -0.0725 },
    ],
  },
  {
    id: 'cg-8',
    name: 'Columbia Road Flower Market',
    caseCount: 4,
    urgency: 'low',
    boundary: [
      { lat: 51.5305, lng: -0.0695 },
      { lat: 51.5305, lng: -0.0675 },
      { lat: 51.5295, lng: -0.0675 },
      { lat: 51.5295, lng: -0.0695 },
    ],
  },
];
