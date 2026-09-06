import asyncio
import logging
import sys
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine
from app.models.user import User, UserRole
from app.auth.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

DEMO_USERS = [
    {
        "name": "System Administrator",
        "email": "admin@example.com",
        "password": "Admin@123",
        "role": UserRole.ADMIN,
    },
    {
        "name": "Head Examiner",
        "email": "examiner@example.com",
        "password": "Examiner@123",
        "role": UserRole.EXAMINER,
    },
    {
        "name": "Alex Student",
        "email": "student@example.com",
        "password": "Student@123",
        "role": UserRole.STUDENT,
    },
]

async def seed_users():
    """Seed development demo users if they do not already exist."""
    logger.info("Checking and seeding development demo users...")
    async with AsyncSessionLocal() as session:
        for u in DEMO_USERS:
            stmt = select(User).where(User.email == u["email"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            if not existing:
                user = User(
                    name=u["name"],
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"],
                    is_active=True,
                )
                session.add(user)
                logger.info(f"Created demo user: {u['email']} (role: {u['role'].value})")
            else:
                logger.info(f"User already exists: {u['email']}")

        await session.commit()
    logger.info("Demo user seeding complete.")

if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass
    asyncio.run(seed_users())
