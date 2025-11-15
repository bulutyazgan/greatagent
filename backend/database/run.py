"""
Entry point to run the FastAPI server
"""
import uvicorn
from config import settings

if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )
