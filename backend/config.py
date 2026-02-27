from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Neo4j
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Redis
    redis_url: str = "redis://localhost:6379"

    # External APIs
    reka_api_key: str
    yutori_api_key: str
    pioneer_api_key: str = ""
    pioneer_base_url: str = "https://api.gliner.pioneer.ai"
    # job_id of a pre-trained Pioneer model to use for inference (set after training)
    pioneer_model_job_id: str = ""

    # App
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    insurance_portal_url: str = "https://insecureco.vercel.app"


settings = Settings()
