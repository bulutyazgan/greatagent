-- ============================================================================
-- Agent Messages Table
-- ============================================================================
--
-- Enables bidirectional communication between helper and victim agents
-- for a specific assignment/case.
--
-- FLOW:
-- 1. Helper agent asks question → creates message with sender='helper_agent'
-- 2. Victim sees question in their panel → polls for new messages
-- 3. Victim responds → creates message with sender='victim_agent'
-- 4. Helper agent receives response → polls for new messages
--
-- MESSAGE TYPES:
-- - 'question': Helper agent requesting information from victim
-- - 'answer': Victim agent responding to helper's question
-- - 'status_update': Either side providing status information
-- - 'guidance': Agent providing actionable guidance
--
-- SENDER TYPES:
-- - 'helper_agent': Message from helper's agent (questions, requests for info)
-- - 'victim_agent': Message from victim's agent (answers, status updates)
-- - 'helper_user': Direct message from helper (manual input)
-- - 'victim_user': Direct message from victim (manual input)

CREATE TABLE IF NOT EXISTS agent_messages (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

    -- Who sent this message
    sender VARCHAR(50) NOT NULL, -- 'helper_agent', 'victim_agent', 'helper_user', 'victim_user'

    -- Message content
    message_type VARCHAR(50) NOT NULL, -- 'question', 'answer', 'status_update', 'guidance'
    message_text TEXT NOT NULL,

    -- Optional: For questions with multiple choice options
    options JSONB, -- Array of {id, label} objects for interactive questions
    question_type VARCHAR(20), -- 'single', 'multiple', null

    -- Optional: For tracking responses to questions
    in_response_to INTEGER REFERENCES agent_messages(id), -- ID of message this responds to

    -- Delivery tracking
    read_by_recipient BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Find all messages for an assignment (main query)
CREATE INDEX IF NOT EXISTS idx_agent_messages_assignment
    ON agent_messages(assignment_id, created_at DESC);

-- Find all messages for a case
CREATE INDEX IF NOT EXISTS idx_agent_messages_case
    ON agent_messages(case_id, created_at DESC);

-- Find unread messages (for polling)
CREATE INDEX IF NOT EXISTS idx_agent_messages_unread
    ON agent_messages(assignment_id, read_by_recipient, created_at DESC);

-- Find messages by sender type
CREATE INDEX IF NOT EXISTS idx_agent_messages_sender
    ON agent_messages(assignment_id, sender, created_at DESC);

-- Thread tracking (responses to specific messages)
CREATE INDEX IF NOT EXISTS idx_agent_messages_response_to
    ON agent_messages(in_response_to);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE agent_messages IS
'Bidirectional communication channel between helper and victim agents during an active assignment';

COMMENT ON COLUMN agent_messages.sender IS
'Who sent: helper_agent (AI), victim_agent (AI), helper_user (manual), victim_user (manual)';

COMMENT ON COLUMN agent_messages.message_type IS
'Type: question (needs answer), answer (responding), status_update, guidance';

COMMENT ON COLUMN agent_messages.options IS
'JSON array of button options for interactive questions: [{"id": "safe", "label": "I am safe"}]';

COMMENT ON COLUMN agent_messages.in_response_to IS
'Message ID this is responding to, null for initial messages';
