"""
Creates a single admin account directly in the DB — the only way to get one,
since /auth/register deliberately rejects role=admin.

Run: python scripts/create_admin.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import User, UserRole

ADMIN_EMAIL = "admin@demo.com"
ADMIN_PASSWORD = "AdminDemo1234!"

def create_admin():
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == ADMIN_EMAIL).first():
            print(f"Admin '{ADMIN_EMAIL}' already exists — nothing to do.")
            return
        admin = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            name="Admin",
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.commit()
        print(f"Created admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()