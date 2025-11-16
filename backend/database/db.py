"""
Database connection module using psycopg2
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import time
from langsmith import traceable
from typing import Optional

# Database configuration - hardcoded for service layer use
# (config.py is only for database/api.py)
DB_CONFIG = {
    'dbname': 'beacon',
    'user': 'beacon_user',
    'password': 'beacon_local_dev',
    'host': 'localhost',
    'port': 5432
}


@contextmanager
def get_db_connection():
    """
    Context manager for database connections
    Automatically handles connection cleanup
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


class TracedCursor:
    """Wrapper around psycopg2 cursor that traces all queries to LangSmith"""

    def __init__(self, cursor):
        self._cursor = cursor
        self.query_count = 0
        self.total_time = 0

    @traceable(name="database_query")
    def execute(self, query, params=None):
        """Execute a query with LangSmith tracing"""
        start_time = time.time()
        try:
            result = self._cursor.execute(query, params)
            execution_time = time.time() - start_time
            self.query_count += 1
            self.total_time += execution_time

            # Log query details to LangSmith
            return {
                "query": query[:500],  # Truncate long queries
                "params": str(params)[:200] if params else None,
                "execution_time_ms": round(execution_time * 1000, 2),
                "rows_affected": self._cursor.rowcount
            }
        except Exception as e:
            execution_time = time.time() - start_time
            raise e

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size)

    def __getattr__(self, name):
        """Delegate all other attributes to the wrapped cursor"""
        return getattr(self._cursor, name)


@contextmanager
def get_db_cursor(commit=True, traced=True):
    """
    Context manager for database cursor with dictionary rows

    Args:
        commit: Whether to commit changes on success
        traced: Whether to wrap cursor with LangSmith tracing
    """
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Wrap with tracing if requested
        if traced:
            cursor = TracedCursor(cursor)

        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            if hasattr(cursor, '_cursor'):
                cursor._cursor.close()
            else:
                cursor.close()
