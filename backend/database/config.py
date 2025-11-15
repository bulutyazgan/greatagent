"""
Configuration management for the API
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database
    db_name: str = "beacon"
    db_user: str = "beacon_user"
    db_password: str = "beacon_local_dev"
    db_host: str = "localhost"
    db_port: int = 5432

    # API
    api_title: str = "Beacon Emergency Response API"
    api_version: str = "1.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True

    # CORS
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_prefix = ""
        case_sensitive = False


# Global settings instance
settings = Settings()
