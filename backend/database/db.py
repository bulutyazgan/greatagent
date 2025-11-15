"""
Database connection module using psycopg2
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

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


@contextmanager
def get_db_cursor(commit=True):
    """
    Context manager for database cursor with dictionary rows
    """
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
