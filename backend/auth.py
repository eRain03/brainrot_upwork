from fastapi import Security, HTTPException, Depends, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from datetime import datetime
from database import SessionLocal
from models import APIKey, UsageLog

API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_api_key(
    api_key_header: str = Security(api_key_header),
    db: Session = Depends(get_db)
):
    if not api_key_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )
    
    # Remove "Bearer " prefix if present
    if api_key_header.startswith("Bearer "):
        key_value = api_key_header.split(" ")[1]
    else:
        key_value = api_key_header

    key_record = db.query(APIKey).filter(APIKey.key_value == key_value).first()

    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API Key"
        )
    
    if key_record.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="API Key is banned or inactive"
        )

    if key_record.expiry_date and key_record.expiry_date < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="API Key has expired"
        )
    
    # Update usage stats
    key_record.last_used_at = datetime.utcnow()
    key_record.usage_count += 1
    db.commit()

    return key_record
