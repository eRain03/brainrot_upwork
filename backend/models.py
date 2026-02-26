from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key_value = Column(String, unique=True, index=True)
    user_identifier = Column(String, index=True) # e.g. email or user ID
    eldorado_email = Column(String, nullable=True) # Bound Eldorado email
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0)
    status = Column(String, default="active") # active, banned

class Config(Base):
    __tablename__ = "config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(Integer, ForeignKey("api_keys.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)
    action = Column(String)
