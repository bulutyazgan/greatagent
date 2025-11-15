"""
Database connection module using psycopg2
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from config import settings

# Database configuration
DB_CONFIG = {
    'dbname': settings.db_name,
    'user': settings.db_user,
    'password': settings.db_password,
    'host': settings.db_host,
    'port': settings.db_port
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
