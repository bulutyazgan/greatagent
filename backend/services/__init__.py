"""
BEACON Backend Services

Service layer for emergency response coordination.
Handles business logic, database operations, and agent pipeline orchestration.

Modules:
- users: User management and location tracking
- cases: Case lifecycle and processing
- helpers: Helper operations and assignments
- guides: AI-generated guidance retrieval
- research: Agent pipeline orchestration
"""

from . import users
from . import cases
from . import helpers
from . import guides
from . import research

__all__ = [
    'users',
    'cases',
    'helpers',
    'guides',
    'research'
]
