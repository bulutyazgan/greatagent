"""
Beacon Emergency Response Database Package
"""
# Don't auto-import api to avoid circular dependencies
from .db import get_db_connection, get_db_cursor

__all__ = [
    'get_db_connection',
    'get_db_cursor'
]
