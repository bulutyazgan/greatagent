# Frontend-Backend Integration Plan

## Current Status

### Backend ✅ DEPLOYED
- **API Server**: Running on http://localhost:8000
- **Database**: PostgreSQL on localhost:5432 with all schemas applied
- **Endpoints**: 16 REST endpoints fully functional
- **AI Agents**: InputProcessingAgent, CallerGuideAgent, HelperGuideAgent operational
- **Test Results**: All integration tests passing

### Frontend ⚠️ NOT CONNECTED
- **Development Server**: Not yet started
- **Data Source**: Using mock data files
- **API Client**: Just created (`frontend/src/services/api.ts`)
- **Integration**: Zero API calls implemented

---

## Backend Features Analysis

### 1. User & Location Management
- `POST /api/users/location-consent` - Create/update user with location consent
  **Generates UUID** for anonymous users, stores location, logs tracking

- `GET /api/users/{user_id}` - Get user profile

- `GET /api/users/{user_id}/location-history` - Location tracking history

### 2. Case Management (Victim Flow)
- `POST /api/cases` - Create help request
  **Returns immediately**, triggers **InputProcessingAgent** async
  Agent extracts: people_count, mobility_status, vulnerability_factors, urgency, danger_level

- `GET /api/cases/{case_id}` - Get full case details with AI-extracted fields

- `GET /api/cases/nearby` - Proximity search for helpers (Haversine distance)

- `GET /api/cases/{case_id}/route` - Get route from helper to case (TODO: Google Maps integration)

### 3. AI Guidance Features
- `GET /api/cases/{case_id}/caller-guide` - AI-generated guidance for victims
  **Status**: `processing` or guide with 3 bullet points
  Uses **Valyu DeepSearch** → **CallerGuideAgent** (Claude Haiku)

- `GET /api/assignments/{assignment_id}/helper-guide` - AI-generated guidance for responders
  Triggered when helper claims case, returns research-based action steps

### 4. Helper Operations
- `GET /api/helpers/nearby` - Find helpers near location with skill filtering

- `POST /api/assignments` - Helper claims case
  **Creates assignment**, updates case status, triggers **HelperGuideAgent** async

- `GET /api/assignments/{assignment_id}` - Get assignment details

- `GET /api/assignments/helper/{helper_user_id}` - Get helper's active assignments

- `PATCH /api/assignments/{assignment_id}/complete` - Mark assignment complete

---

## Frontend Structure Analysis

### Current Components

**Entry Flow**:
- `App.tsx` - Main app with role selection → disaster selection → dashboard flow
- `RoleSelection.tsx` - Choose victim/responder
- `DisasterSelectionDialog.tsx` - Auto-select nearest disaster

**Victim Components**:
- `RequestHelpDialog.tsx` - Form to submit help request ⚠️ **TODO: API integration**
- Map displays help requests from `mock-help-requests.ts`

**Responder Components**:
- Map with nearby cases
- No claim/assignment UI yet ❌

**Map Components**:
- `MapContainer.tsx` - Google Maps with markers
- `VictimMarkers.tsx` - Case markers colored by urgency
- `HeatmapLayer.tsx` - Density visualization
- `UserLocationMarker.tsx` - Current user position

**Data Layer**:
- `frontend/src/data/mock-*.ts` - All mock data
- No API calls currently

---

## Integration Roadmap

### Phase 1: User Location Consent ✅ READY TO IMPLEMENT

**When**: On app load, after role selection

**Frontend Changes**:
1. Create custom hook `useUserIdentity.ts`:
   - Check localStorage for `beacon_user_id`
   - If not found, call `createOrUpdateUserLocation()` on geolocation
   - Store returned `user_id` in localStorage
   - Track user role (victim/responder)

2. Update `RoleSelection.tsx`:
   ```typescript
   import { createOrUpdateUserLocation } from '@/services/api';

   const handleRoleSelect = async (role: 'victim' | 'responder') => {
     // Get geolocation
     // Call API to create/update user
     // Store user_id in localStorage
   };
   ```

**Backend Endpoint**:
```
POST /api/users/location-consent
Body: { latitude, longitude, is_helper, name?, helper_skills?, helper_max_range? }
Response: { user_id, location, created_at, action: 'created'|'updated' }
```

---

### Phase 2: Create Help Request (Victim Flow) ✅ READY TO IMPLEMENT

**When**: Victim clicks "Request Help" FAB and submits form

**Frontend Changes**:
1. Update `RequestHelpDialog.tsx` line 168:
   ```typescript
   const handleSubmit = async () => {
     if (!validateForm()) return;

     setSubmitting(true);

     try {
       const userId = localStorage.getItem('beacon_user_id');

       const response = await createCase({
         user_id: userId,
         latitude: formData.location!.latitude,
         longitude: formData.location!.longitude,
         raw_problem_description: formData.description,
       });

       // Save case_id to track for guide polling
       localStorage.setItem('last_case_id', response.case_id.toString());

       toast.success('Help request submitted!', {
         description: 'AI is analyzing your situation...'
       });

       onClose();

       // Start polling for caller guide
       pollForCallerGuide(response.case_id);

     } catch (error) {
       toast.error('Failed to submit', {
         description: error.message
       });
     } finally {
       setSubmitting(false);
     }
   };
   ```

2. Create `useCaller Guide.ts` hook for polling:
   ```typescript
   // Poll every 3 seconds for up to 30 seconds
   // Display guide when ready
   ```

**Backend Flow**:
1. `POST /api/cases` → Creates case → Returns immediately
2. Background: **InputProcessingAgent** extracts structured data
3. Background: **ResearchAgent** → **CallerGuideAgent** generates guidance
4. Frontend polls `GET /api/cases/{id}/caller-guide` until status != 'processing'

---

### Phase 3: Display Nearby Cases (Responder Map) ✅ READY TO IMPLEMENT

**When**: Responder views dashboard

**Frontend Changes**:
1. Update `Dashboard.tsx`:
   ```typescript
   import { getNearbyCases } from '@/services/api';

   useEffect(() => {
     if (userRole === 'responder' && userLocation) {
       const fetchCases = async () => {
         try {
           const cases = await getNearbyCases(
             userLocation.latitude,
             userLocation.longitude,
             10, // 10km radius
             ['open', 'assigned']
           );

           // Convert backend format to frontend HelpRequest type
           const helpRequests = cases.map(mapCaseToHelpRequest);
           setHelpRequests(helpRequests);

         } catch (error) {
           console.error('Failed to fetch cases:', error);
         }
       };

       fetchCases();

       // Poll every 10 seconds for real-time updates
       const interval = setInterval(fetchCases, 10000);
       return () => clearInterval(interval);
     }
   }, [userRole, userLocation]);
   ```

2. Create mapping function:
   ```typescript
   function mapCaseToHelpRequest(apiCase: Case): HelpRequest {
     return {
       id: apiCase.case_id.toString(),
       type: inferTypeFromDescription(apiCase.description),
       location: apiCase.location,
       peopleCount: apiCase.people_count,
       urgency: apiCase.urgency,
       status: apiCase.status,
       description: apiCase.description || apiCase.raw_problem_description,
       vulnerabilityFactors: apiCase.vulnerability_factors,
       mobilityStatus: apiCase.mobility_status,
       timestamp: apiCase.created_at,
     };
   }
   ```

**Backend Endpoint**:
```
GET /api/cases/nearby?latitude=X&longitude=Y&radius_km=10&status_filter=open&status_filter=assigned
Response: Case[] with AI-extracted fields
```

---

### Phase 4: Claim Case (Responder Action) ❌ NEW FEATURE

**When**: Responder clicks "I'm Responding" button on case marker

**Frontend Changes**:
1. Create `HelpRequestDetailsDialog.tsx`:
   ```tsx
   interface Props {
     helpRequest: HelpRequest;
     onClaim: (caseId: number) => void;
   }

   export function HelpRequestDetailsDialog({ helpRequest, onClaim }: Props) {
     const [claiming, setClaiming] = useState(false);

     const handleClaim = async () => {
       setClaiming(true);
       try {
         const userId = parseInt(localStorage.getItem('beacon_user_id')!);

         const assignment = await createAssignment({
           case_id: parseInt(helpRequest.id),
           helper_user_id: userId,
           notes: 'Responding to emergency',
         });

         // Save assignment for helper guide polling
         localStorage.setItem('active_assignment_id', assignment.assignment_id.toString());

         toast.success('Case claimed!', {
           description: 'Generating helper guidance...'
         });

         onClaim(parseInt(helpRequest.id));

         // Start polling for helper guide
         pollForHelperGuide(assignment.assignment_id);

       } catch (error) {
         toast.error('Failed to claim', {
           description: error.message
         });
       } finally {
         setClaiming(false);
       }
     };

     return (
       <Dialog>
         {/* Case details */}
         <Button onClick={handleClaim} disabled={claiming}>
           {claiming ? 'Claiming...' : "I'm Responding"}
         </Button>
       </Dialog>
     );
   }
   ```

2. Update `Dashboard.tsx` to open details dialog on marker click

**Backend Flow**:
1. `POST /api/assignments` → Creates assignment → Returns immediately
2. Background: **HelperGuideAgent** generates responder guidance
3. Frontend polls `GET /api/assignments/{id}/helper-guide` until ready

---

### Phase 5: Display AI Guides ❌ NEW FEATURE

**Frontend Changes**:
1. Create `CallerGuidePanel.tsx`:
   ```tsx
   export function CallerGuidePanel({ caseId }: { caseId: number }) {
     const [guide, setGuide] = useState<CallerGuide | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       const fetchGuide = async () => {
         try {
           const result = await getCallerGuide(caseId);
           if (result.status !== 'processing') {
             setGuide(result);
             setLoading(false);
           }
         } catch (error) {
           console.error('Failed to fetch guide:', error);
         }
       };

       // Poll every 3 seconds
       const interval = setInterval(fetchGuide, 3000);
       return () => clearInterval(interval);
     }, [caseId]);

     if (loading) {
       return (
         <Card>
           <CardHeader>
             <Loader2 className="animate-spin" />
             <p>AI is analyzing your situation and generating safety guidance...</p>
           </CardHeader>
         </Card>
       );
     }

     return (
       <Card>
         <CardHeader>
           <h3>Safety Guidance</h3>
           <Badge>AI-Generated</Badge>
         </CardHeader>
         <CardContent>
           <ReactMarkdown>{guide.guide_text}</ReactMarkdown>
           {guide.research_query && (
             <Details>
               <summary>Research Sources</summary>
               <p>{guide.research_results_summary}</p>
             </Details>
           )}
         </CardContent>
       </Card>
     );
   }
   ```

2. Create similar `HelperGuidePanel.tsx` for responders

3. Add guides to Dashboard layout:
   - Victim: Show `CallerGuidePanel` in right panel after submitting request
   - Responder: Show `HelperGuidePanel` in right panel after claiming case

**Backend Endpoints**:
```
GET /api/cases/{case_id}/caller-guide
GET /api/assignments/{assignment_id}/helper-guide

Response (processing):
{ "status": "processing", "message": "Guide is being generated..." }

Response (ready):
{
  "guide_id": 1,
  "guide_text": "- Action 1\n- Action 2\n- Action 3",
  "research_query": "immediate actions while trapped in building",
  "research_results_summary": "...",
  "created_at": "2025-11-15T23:00:00"
}
```

---

### Phase 6: Replace Mock Data

**Files to Update**:
1. `frontend/src/data/mock-help-requests.ts` → Delete, replace with API calls
2. `frontend/src/data/mock-disaster.ts` → Keep for now (no backend emergency management yet)
3. `frontend/src/data/mock-news.ts` → Keep (no backend)
4. `frontend/src/data/mock-alerts.ts` → Keep (no backend)
5. `frontend/src/data/mock-resources.ts` → Keep (no backend)

**Components to Update**:
1. `Dashboard.tsx` - Remove mock imports, use API
2. `HelpRequestList.tsx` - Receive props from API data
3. `VictimMarkers.tsx` - Receive props from API data

---

## Implementation Order

### Immediate (30 minutes):
1. ✅ Create `frontend/src/services/api.ts` (DONE)
2. ✅ Add `VITE_API_BASE_URL` to `.env` (DONE)
3. ⏳ Create `useUserIdentity.ts` hook
4. ⏳ Update `RoleSelection.tsx` to call location consent API

### Short-term (1-2 hours):
5. ⏳ Update `RequestHelpDialog.tsx` to call `createCase()` API
6. ⏳ Create `useCallerGuide.ts` hook for polling
7. ⏳ Create `CallerGuidePanel.tsx` component
8. ⏳ Update `Dashboard.tsx` to fetch nearby cases from API

### Medium-term (2-3 hours):
9. ⏳ Create `HelpRequestDetailsDialog.tsx` with claim functionality
10. ⏳ Create `useHelperGuide.ts` hook for polling
11. ⏳ Create `HelperGuidePanel.tsx` component
12. ⏳ Update `Dashboard.tsx` to show guides after actions

### Long-term (future):
13. ⏳ WebSocket integration for real-time updates
14. ⏳ Complete assignment flow (mark complete)
15. ⏳ Helper active assignments panel
16. ⏳ Remove all mock data files

---

## Key Integration Points

### Type Mapping
Backend uses `snake_case`, frontend uses `camelCase`.
**Solution**: Create mapper functions in `api.ts` OR update TypeScript types to match backend exactly.

### UUID Management
Backend generates UUID for anonymous users.
**Solution**: Store in `localStorage` under `beacon_user_id`.

### Polling Strategy
Guides take 5-15 seconds to generate.
**Solution**: Poll every 3 seconds for max 30 seconds, then show "Still processing, check back later".

### Error Handling
API calls can fail (network, server errors).
**Solution**: Use `toast.error()` (Sonner) for user feedback, log to console for debugging.

### Loading States
API calls are async.
**Solution**: Add loading spinners to buttons, show skeleton screens in panels.

---

## Testing Plan

1. **Start backend**: `cd backend && uvicorn app:app --reload`
2. **Start frontend**: `cd frontend && npm run dev`
3. **Test victim flow**:
   - Select "I need help" role
   - Submit help request
   - Wait for AI guide (should appear within 10-15 seconds)
4. **Test responder flow**:
   - Select "I can help" role
   - See cases on map
   - Click marker, claim case
   - Wait for helper guide
5. **Test real-time**: Open two browsers, create case in one, should appear in other

---

## Next Steps

**Ready to implement**? I'll proceed in this order:

1. Create `useUserIdentity.ts` hook
2. Update `RoleSelection.tsx` to integrate with API
3. Update `RequestHelpDialog.tsx` to create cases via API
4. Create AI guide components and polling hooks
5. Start frontend development server and test end-to-end

Proceed with implementation?
