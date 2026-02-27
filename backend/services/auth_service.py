from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import settings

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)
bearer_scheme = HTTPBearer()


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except UnknownHashError:
        # Backward compatibility for legacy bcrypt hashes.
        if hashed.startswith("$2"):
            try:
                return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
            except ValueError:
                return False
        return False


def _create_token(user_id: str, expires_delta: timedelta, token_type: str) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": user_id, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.access_token_expire_minutes),
        "access",
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(days=settings.refresh_token_expire_days),
        "refresh",
    )


def decode_token(token: str, expected_type: str = "access") -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != expected_type:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    payload = decode_token(credentials.credentials, expected_type="access")
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user_id


async def get_admin_user(user_id: str = Depends(get_current_user)) -> str:
    # In production: check user has admin role in Neo4j.
    # For now, any authenticated user can access admin endpoints during development.
    return user_id
