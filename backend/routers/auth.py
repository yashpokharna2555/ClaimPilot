import uuid

from fastapi import APIRouter, HTTPException, status

from db.neo4j_driver import get_session
from models.auth import LoginRequest, RegisterRequest, RefreshRequest, TokenPair
from services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter()


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    async with get_session() as session:
        # Check for existing user
        result = await session.run(
            "MATCH (u:User {email: $email}) RETURN u",
            email=body.email,
        )
        existing = await result.single()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        await session.run(
            """
            CREATE (u:User {
                id: $id,
                email: $email,
                password_hash: $password_hash,
                name: $name,
                phone: $phone,
                license_state: $license_state,
                created_at: datetime()
            })
            """,
            id=user_id,
            email=body.email,
            password_hash=hash_password(body.password),
            name=body.name,
            phone=body.phone,
            license_state=body.license_state,
        )

    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest):
    async with get_session() as session:
        result = await session.run(
            "MATCH (u:User {email: $email}) RETURN u",
            email=body.email,
        )
        record = await result.single()

    if not record or not verify_password(body.password, record["u"]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = record["u"]["id"]
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    payload = decode_token(body.refresh_token, expected_type="refresh")
    user_id = payload["sub"]
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )
