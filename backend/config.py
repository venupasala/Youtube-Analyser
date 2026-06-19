"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    YOUTUBE_API_KEY: str
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    CHROMADB_HOST: str = "chromadb"
    CHROMADB_PORT: int = 8000
    DEFAULT_REGION: str = "US"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
