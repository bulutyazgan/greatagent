-- BEACON DATABASE SCHEMA
-- Emergency response coordination system connecting helpers with people in distress
-- 
-- ARCHITECTURE: 3-layer hierarchy
-- Layer 1: Emergencies (city-wide disasters like wildfires, earthquakes)
-- Layer 2: Case Groups (logical groupings like "Building 5" or "North evacuation route")
-- Layer 3: Cases (individual help requests, possibly anonymous)
--
-- KEY CONCEPTS:
-- - Users can be helpers (have skills) OR callers (need help), but NOT both simultaneously
-- - Cases can be self-reported or reported by others (including AI agents)
-- - Multiple helpers can be assigned to a single case via assignments table
-- - All activity tracked in centralized updates table for complete audit trail

-- ============================================================================
-- USERS & LOCATION
-- ============================================================================

-- Users: Core identity for both helpers and callers
-- A user becomes a helper when helper_skills is populated
-- A user becomes a caller when they create a case
-- Cannot be both helper and caller simultaneously (enforced in app logic)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location POINT NOT NULL, -- Current location (lat, long)
    contact_info VARCHAR(255), -- Phone, email for emergency contact
    helper_skills TEXT[], -- NULL for non-helpers, array like ['medical', 'search_rescue', 'first_aid']
    helper_max_range INTEGER, -- Max distance in meters helper willing to travel, NULL for non-helpers
    created_at TIMESTAMP DEFAULT NOW()
);

-- Location tracking: Historical record of user movement
-- Critical for: proximity matching, evacuation route tracking, helper availability
CREATE TABLE location_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    location POINT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- EMERGENCY HIERARCHY (3 LAYERS)
-- ============================================================================

-- Layer 1: Emergencies
-- City-wide or region-wide disaster events (wildfire, earthquake, flood)
-- Top level of hierarchy - all cases ultimately roll up to an emergency
CREATE TABLE emergencies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- "San Francisco Wildfire 2025"
    area VARCHAR(255) NOT NULL, -- Geographic region affected
    description TEXT,
    type VARCHAR(50) NOT NULL, -- flood, wildfire, earthquake
    status VARCHAR(50) DEFAULT 'active', -- active, contained, resolved
    severity_level VARCHAR(50), -- low, medium, high, critical
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP -- NULL while ongoing
);

-- Layer 2: Case Groups
-- Logical groupings of related cases for coordinated response
-- Examples: "Building 5, Floor 3", "North evacuation route", "Marina District fires"
-- Groups enable: assigning one helper to multiple related cases, coordinating evacuation routes
-- case_group_id in cases table can be NULL for standalone incidents
CREATE TABLE case_groups (
    id SERIAL PRIMARY KEY,
    emergency_id INTEGER NOT NULL REFERENCES emergencies(id),
    description TEXT, -- Human-readable description of what links these cases
    group_status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved
    created_at TIMESTAMP DEFAULT NOW()
);

-- Layer 3: Cases
-- Individual help requests - the atomic unit of coordination
-- 
-- CALLER TYPES:
-- 1. Self-reported: caller_user_id = user who needs help, reported_by_user_id = same user
-- 2. Helper-reported: caller_user_id = NULL (anonymous), reported_by_user_id = helper who spotted them
-- 3. AI-detected: caller_user_id = NULL, reported_by_user_id = NULL (e.g., via satellite/camera feeds)
--
-- PEOPLE_COUNT: Can be NULL when unknown (e.g., "people trapped in building" without exact count)
-- MULTIPLE HELPERS: assigned via assignments table (many-to-many), not stored here
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    caller_user_id INTEGER REFERENCES users(id), -- NULL for anonymous callers (never logged in)
    reported_by_user_id INTEGER REFERENCES users(id), -- Who reported? NULL for AI-detected cases
    case_group_id INTEGER REFERENCES case_groups(id), -- NULL for ungrouped/standalone cases
    location POINT NOT NULL, -- Exact coordinates of incident
    description TEXT, -- Free text: "Trapped in collapsed building, 3rd floor"
    raw_problem_description TEXT, -- Free text: "Exactly what the user typed"
    people_count INTEGER, -- NULL when unknown, critical for resource allocation
    mobility_status VARCHAR(50), -- mobile, injured, trapped - affects urgency
    vulnerability_factors TEXT[], -- ['elderly', 'children_present', 'medical_needs'] - prioritization
    urgency VARCHAR(50) NOT NULL, -- low, medium, high, critical - how soon help is needed
    danger_level VARCHAR(50) NOT NULL, -- safe, moderate, severe, life_threatening - risk to victim
    status VARCHAR(50) DEFAULT 'open', -- open, assigned, in_progress, resolved, closed
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP -- When case successfully closed
);

-- ============================================================================
-- COORDINATION & HISTORY
-- ============================================================================

-- Assignments: Many-to-many relationship between cases and helpers
-- WHY SEPARATE TABLE: 
-- - Multiple helpers can work same case
-- - Track full history of who was assigned (even if reassigned)
-- - Record outcomes (successful, failed, cancelled) for metrics
-- - Assignment history persists even after case resolved
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    helper_user_id INTEGER NOT NULL REFERENCES users(id), -- Must have helper_skills populated
    assigned_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP, -- NULL while active
    outcome VARCHAR(50) -- successful, failed, reassigned, cancelled - for performance tracking
);

-- Updates: Single source of truth for all activity across all layers
-- DESIGN: Centralized timeline instead of separate update tables per entity
-- Any update can reference emergency, case_group, case, and/or assignment
-- Query latest status: SELECT * FROM updates WHERE case_id = X ORDER BY timestamp DESC LIMIT 1
--
-- EXAMPLES:
-- - Emergency update: only emergency_id populated ("Fire spreading northeast")
-- - Case update: emergency_id + case_group_id + case_id ("Helper arrived at scene")
-- - Assignment update: all IDs populated ("Helper completed evacuation")
CREATE TABLE updates (
    id SERIAL PRIMARY KEY,
    emergency_id INTEGER REFERENCES emergencies(id), -- Which emergency (can be NULL for non-emergency updates)
    case_group_id INTEGER REFERENCES case_groups(id), -- Which group (can be NULL)
    case_id INTEGER REFERENCES cases(id), -- Which case (can be NULL for group-level updates)
    assignment_id INTEGER REFERENCES assignments(id), -- Which assignment (can be NULL)
    update_source VARCHAR(50) NOT NULL, -- helper, caller, ai_agent, official
    update_type VARCHAR(50) NOT NULL, -- status_change, location_update, assignment_created, new_info
    update_text TEXT, -- Human-readable description
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Research Reports: AI-generated insights and analysis for emergency coordination
-- Used for: situational awareness, resource planning, trend analysis
CREATE TABLE research_reports (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL, -- "Wildfire spread analysis", "Resource allocation optimization"
    report TEXT NOT NULL, -- Full report content
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Spatial indexes for proximity queries (finding nearby helpers/cases)
CREATE INDEX idx_users_location ON users USING GIST(location);
CREATE INDEX idx_cases_location ON cases USING GIST(location);

-- Foreign key indexes for joins
CREATE INDEX idx_location_tracking_user ON location_tracking(user_id);
CREATE INDEX idx_case_groups_emergency ON case_groups(emergency_id);
CREATE INDEX idx_cases_case_group ON cases(case_group_id);
CREATE INDEX idx_cases_caller ON cases(caller_user_id);
CREATE INDEX idx_cases_reported_by ON cases(reported_by_user_id);
CREATE INDEX idx_assignments_helper ON assignments(helper_user_id);

-- Status filtering (finding open cases, available helpers)
CREATE INDEX idx_cases_status ON cases(status);

-- Timeline queries (recent updates, activity feeds)
CREATE INDEX idx_updates_emergency ON updates(emergency_id);
CREATE INDEX idx_updates_case_group ON updates(case_group_id);
CREATE INDEX idx_updates_case ON updates(case_id);
CREATE INDEX idx_updates_assignment ON updates(assignment_id);
CREATE INDEX idx_updates_timestamp ON updates(timestamp DESC);

-- Index for chronological queries
CREATE INDEX idx_research_reports_created ON research_reports(created_at DESC);
