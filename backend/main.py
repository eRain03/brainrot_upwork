from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import secrets

from database import engine, Base, SessionLocal
from models import APIKey, Config
from auth import get_api_key, get_db
from ai_service import analyze_image_with_ai
from market_service import fetch_market_prices
from pydantic import BaseModel
from typing import Optional, List

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Eldorado AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for MVP, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---
class KeyCreate(BaseModel):
    user_identifier: str
    days_valid: Optional[int] = None # None means infinite

class KeyResponse(BaseModel):
    id: int
    key_value: str
    user_identifier: str
    eldorado_email: Optional[str]
    expiry_date: Optional[datetime]
    created_at: datetime
    last_used_at: Optional[datetime]
    usage_count: int
    status: str

    class Config:
        from_attributes = True

class KeyUpdate(BaseModel):
    days_valid: Optional[int] = None
    status: Optional[str] = None
    eldorado_email: Optional[str] = None

class BindEmailRequest(BaseModel):
    eldorado_email: str

class ConfigResponse(BaseModel):
    key: str
    value: str

class ConfigUpdate(BaseModel):
    value: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# --- Admin Auth (Simple) ---
def verify_admin(x_admin_secret: str = Header(..., alias="X-Admin-Secret"), db: Session = Depends(get_db)):
    config_entry = db.query(Config).filter(Config.key == 'ADMIN_SECRET').first()
    expected_secret = config_entry.value if config_entry else "admin-secret-123"
    if x_admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "time": datetime.utcnow()}

@app.get("/me", response_model=KeyResponse)
def get_my_info(api_key: APIKey = Depends(get_api_key)):
    return api_key

@app.post("/bind-email", response_model=KeyResponse)
def bind_eldorado_email(
    request: BindEmailRequest,
    api_key: APIKey = Depends(get_api_key),
    db: Session = Depends(get_db)
):
    if api_key.eldorado_email:
        raise HTTPException(status_code=400, detail="Email already bound. Contact admin to change.")
    
    api_key.eldorado_email = request.eldorado_email
    db.commit()
    db.refresh(api_key)
    return api_key

# Client Endpoint: Analyze Image
@app.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    api_key: APIKey = Depends(get_api_key),
    db: Session = Depends(get_db)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    config_entry = db.query(Config).filter(Config.key == 'LLM_API_KEY').first()
    llm_key = config_entry.value if config_entry else ""
    if not llm_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")

    contents = await file.read()
    result = await analyze_image_with_ai(contents, llm_key)
    return result

# Client Endpoint: Market Prices
@app.get("/market")
async def get_market_prices(
    ms_rate: Optional[str] = None,
    mutations: Optional[str] = None,
    category: Optional[str] = None,
    item_name: Optional[str] = None,
    api_key: APIKey = Depends(get_api_key)
):
    filters = {
        "ms_rate": ms_rate,
        "mutations": mutations,
        "category": category,
        "item_name": item_name
    }
    result = await fetch_market_prices(filters)
    return result

# Admin Endpoints

@app.post("/admin/login")
def admin_login(_admin: bool = Depends(verify_admin)):
    return {"status": "ok"}

@app.post("/admin/change-password")
def change_admin_password(req: ChangePasswordRequest, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    config_entry = db.query(Config).filter(Config.key == 'ADMIN_SECRET').first()
    expected_secret = config_entry.value if config_entry else "admin-secret-123"
    
    if req.old_password != expected_secret:
        raise HTTPException(status_code=403, detail="Incorrect old password")
        
    if not config_entry:
        config_entry = Config(key="ADMIN_SECRET", value=req.new_password)
        db.add(config_entry)
    else:
        config_entry.value = req.new_password
    db.commit()
    return {"status": "ok", "message": "Password changed successfully"}

@app.post("/admin/keys", response_model=KeyResponse)
def create_key(key_data: KeyCreate, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    
    expiry = None
    if key_data.days_valid:
        expiry = datetime.utcnow() + timedelta(days=key_data.days_valid)
    
    new_key_value = "sk-" + secrets.token_hex(16)
    
    db_key = APIKey(
        key_value=new_key_value,
        user_identifier=key_data.user_identifier,
        expiry_date=expiry
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)
    return db_key

@app.get("/admin/keys", response_model=List[KeyResponse])
def list_keys(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    keys = db.query(APIKey).offset(skip).limit(limit).all()
    return keys

@app.put("/admin/keys/{key_id}", response_model=KeyResponse)
def update_key(key_id: int, key_update: KeyUpdate, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    db_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    if key_update.status:
        db_key.status = key_update.status
    
    if key_update.days_valid is not None:
         db_key.expiry_date = datetime.utcnow() + timedelta(days=key_update.days_valid)
         
    if key_update.eldorado_email is not None:
        db_key.eldorado_email = key_update.eldorado_email if key_update.eldorado_email.strip() else None

    db.commit()
    db.refresh(db_key)
    return db_key

@app.delete("/admin/keys/{key_id}")
def delete_key(key_id: int, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    db_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="Key not found")
    
    # Soft delete (ban) is better, but DELETE usually means remove. 
    # Let's just ban it as per requirements "Ban/Unban".
    db_key.status = "banned"
    db.commit()
    return {"message": "Key banned"}

@app.get("/admin/config", response_model=List[ConfigResponse])
def get_config(db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    return db.query(Config).all()

@app.put("/admin/config/{config_key}", response_model=ConfigResponse)
def update_config(config_key: str, update_data: ConfigUpdate, db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    config_entry = db.query(Config).filter(Config.key == config_key).first()
    if not config_entry:
        # Create it if it doesn't exist
        config_entry = Config(key=config_key, value=update_data.value)
        db.add(config_entry)
    else:
        config_entry.value = update_data.value
    
    db.commit()
    db.refresh(config_entry)
    return config_entry

import httpx
@app.get("/admin/llm-status")
async def check_llm_status(db: Session = Depends(get_db), _admin: bool = Depends(verify_admin)):
    config_entry = db.query(Config).filter(Config.key == 'LLM_API_KEY').first()
    llm_key = config_entry.value if config_entry else ""
    if not llm_key:
        return {"status": "error", "message": "API Key not configured"}
        
    # Simple verification by listing models or making a very small request.
    # iFlow / OpenAI compatible:
    headers = {"Authorization": f"Bearer {llm_key}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://apis.iflow.cn/v1/models", headers=headers)
            if resp.status_code == 200:
                return {"status": "ok", "message": "Connected successfully"}
            else:
                return {"status": "error", "message": f"API Error: {resp.status_code}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
