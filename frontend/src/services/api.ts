/**
 * BEACON API Client
 *
 * Centralized service for all backend API calls.
 * Base URL configured for local development.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LocationConsentRequest {
  user_id?: string | null;
  latitude: number;
  longitude: number;
  name?: string | null;
  contact_info?: string | null;
  is_helper: boolean;
  helper_skills?: string[] | null;
  helper_max_range?: number | null;
}

export interface LocationConsentResponse {
  user_id: string;
  name: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  contact_info: string | null;
  is_helper: boolean;
  helper_skills: string[] | null;
  helper_max_range: number | null;
  created_at: string;
  action: 'created' | 'updated';
}

export interface CreateCaseRequest {
  user_id?: string | null;
  latitude: number;
  longitude: number;
  raw_problem_description: string;
  emergency_id?: number | null;
}

export interface CreateCaseResponse {
  case_id: number;
  caller_user_id: number | null;
  location: {
    latitude: number;
    longitude: number;
  };
  raw_problem_description: string;
  status: string;
  created_at: string;
  processing_started: boolean;
}

export interface Case {
  case_id: number;
  caller_user_id: number | null;
  reported_by_user_id: number | null;
  case_group_id: number | null;
  location: {
    latitude: number;
    longitude: number;
  };
  description: string | null;
  raw_problem_description: string;
  people_count: number | null;
  mobility_status: 'mobile' | 'injured' | 'trapped' | null;
  vulnerability_factors: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  danger_level: 'safe' | 'moderate' | 'severe' | 'life_threatening';
  ai_reasoning: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface CallerGuide {
  guide_id?: number;
  case_id: number;
  guide_text: string;
  research_query: string | null;
  research_results_summary: string | null;
  created_at?: string;
  status?: 'processing';
  message?: string;
}

export interface HelperGuide {
  guide_id?: number;
  assignment_id: number;
  guide_text: string;
  research_query: string | null;
  research_results_summary: string | null;
  created_at?: string;
  status?: 'processing';
  message?: string;
}

export interface CreateAssignmentRequest {
  case_id: number;
  helper_user_id: number;
  notes?: string | null;
}

export interface Assignment {
  assignment_id: number;
  case_id: number;
  helper_user_id: number;
  assigned_at: string;
  completed_at: string | null;
  notes: string | null;
  outcome: string | null;
  guide_generation_started?: boolean;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class APIError extends Error {
  status?: number;
  detail?: any;

  constructor(
    message: string,
    status?: number,
    detail?: any
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(
      errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }
  return response.json();
}

// ============================================================================
// USER & LOCATION ENDPOINTS
// ============================================================================

export async function createOrUpdateUserLocation(
  data: LocationConsentRequest
): Promise<LocationConsentResponse> {
  console.log('[API] Creating/updating user location:', data);

  const response = await fetch(`${API_BASE_URL}/api/users/location-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  console.log('[API] Response status:', response.status);

  return handleResponse<LocationConsentResponse>(response);
}

export async function getUser(userId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);
  return handleResponse(response);
}

export async function getUserLocationHistory(userId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/location-history`);
  return handleResponse(response);
}

// ============================================================================
// CASE ENDPOINTS
// ============================================================================

export async function createCase(
  data: CreateCaseRequest
): Promise<CreateCaseResponse> {
  const response = await fetch(`${API_BASE_URL}/api/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<CreateCaseResponse>(response);
}

export async function getCase(caseId: number): Promise<Case> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}`);
  return handleResponse<Case>(response);
}

export async function getNearbyCases(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  statusFilter: string[] = ['open']
): Promise<Case[]> {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    radius: radiusKm.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/api/cases/nearby?${params}`);
  const data = await handleResponse<{cases: Case[], count: number}>(response);
  return data.cases;
}

export async function getCaseRoute(caseId: number, helperLat: number, helperLon: number): Promise<any> {
  const params = new URLSearchParams({
    helper_lat: helperLat.toString(),
    helper_lon: helperLon.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/route?${params}`);
  return handleResponse(response);
}

// ============================================================================
// GUIDE ENDPOINTS
// ============================================================================

export async function getCallerGuide(caseId: number): Promise<CallerGuide> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/caller-guide`);
  return handleResponse<CallerGuide>(response);
}

export async function getHelperGuide(assignmentId: number): Promise<HelperGuide> {
  const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/helper-guide`);
  return handleResponse<HelperGuide>(response);
}

// ============================================================================
// HELPER ENDPOINTS
// ============================================================================

export async function getNearbyHelpers(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  requiredSkills?: string[]
): Promise<any[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    radius_km: radiusKm.toString(),
  });

  if (requiredSkills && requiredSkills.length > 0) {
    requiredSkills.forEach((skill) => {
      params.append('required_skills', skill);
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/helpers/nearby?${params}`);
  return handleResponse(response);
}

// ============================================================================
// ASSIGNMENT ENDPOINTS
// ============================================================================

export async function createAssignment(
  data: CreateAssignmentRequest
): Promise<Assignment> {
  const response = await fetch(`${API_BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Assignment>(response);
}

export async function getAssignment(assignmentId: number): Promise<Assignment> {
  const response = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}`);
  return handleResponse<Assignment>(response);
}

export async function getCaseAssignments(
  caseId: number
): Promise<any[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/assignments/case/${caseId}`
  );
  const data = await handleResponse<{ assignments: any[], count: number }>(response);
  return data.assignments;
}

export async function getHelperAssignments(
  helperUserId: number,
  includeCompleted: boolean = false
): Promise<any[]> {
  const params = new URLSearchParams({
    include_completed: includeCompleted.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/assignments/helper/${helperUserId}?${params}`
  );
  return handleResponse(response);
}

export async function completeAssignment(
  assignmentId: number,
  outcome: string,
  notes?: string
): Promise<Assignment> {
  const response = await fetch(
    `${API_BASE_URL}/api/assignments/${assignmentId}/complete`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, notes }),
    }
  );
  return handleResponse<Assignment>(response);
}

// ============================================================================
// AGENT MESSAGES (Bidirectional Communication)
// ============================================================================

export interface AgentMessage {
  message_id: number;
  assignment_id: number;
  case_id: number;
  sender: 'helper_agent' | 'victim_agent' | 'helper_user' | 'victim_user';
  message_type: 'question' | 'answer' | 'status_update' | 'guidance';
  message_text: string;
  options?: Array<{ id: string; label: string }> | null;
  question_type?: 'single' | 'multiple' | null;
  in_response_to?: number | null;
  read_by_recipient: boolean;
  read_at: string | null;
  created_at: string;
}

export interface CreateMessageRequest {
  assignment_id: number;
  case_id: number;
  sender: 'helper_agent' | 'victim_agent' | 'helper_user' | 'victim_user';
  message_type: 'question' | 'answer' | 'status_update' | 'guidance';
  message_text: string;
  options?: Array<{ id: string; label: string }> | null;
  question_type?: 'single' | 'multiple' | null;
  in_response_to?: number | null;
}

/**
 * Create a new agent message.
 */
export async function createAgentMessage(request: CreateMessageRequest): Promise<AgentMessage> {
  const response = await fetch(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<AgentMessage>(response);
}

/**
 * Get all messages for an assignment (conversation history).
 */
export async function getAssignmentMessages(
  assignmentId: number,
  senderFilter?: string
): Promise<{ assignment_id: number; messages: AgentMessage[]; count: number }> {
  const params = new URLSearchParams();
  if (senderFilter) params.append('sender_filter', senderFilter);

  const response = await fetch(
    `${API_BASE_URL}/api/assignments/${assignmentId}/messages?${params}`
  );
  return handleResponse(response);
}

/**
 * Get unread messages for a specific recipient.
 * Used for polling.
 */
export async function getUnreadMessages(
  assignmentId: number,
  forSender: 'helper_agent' | 'victim_agent'
): Promise<{ assignment_id: number; unread_messages: AgentMessage[]; count: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/assignments/${assignmentId}/messages/unread?for_sender=${forSender}`
  );
  return handleResponse(response);
}

/**
 * Get the latest unanswered question from the other party.
 */
export async function getLatestQuestion(
  assignmentId: number,
  forSender: 'helper_agent' | 'victim_agent'
): Promise<{ assignment_id: number; question: AgentMessage | null }> {
  const response = await fetch(
    `${API_BASE_URL}/api/assignments/${assignmentId}/messages/latest-question?for_sender=${forSender}`
  );
  return handleResponse(response);
}

/**
 * Mark messages as read.
 */
export async function markMessagesAsRead(messageIds: number[]): Promise<{ marked_as_read: number }> {
  const response = await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_ids: messageIds }),
  });
  return handleResponse(response);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function healthCheck(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return handleResponse(response);
}
