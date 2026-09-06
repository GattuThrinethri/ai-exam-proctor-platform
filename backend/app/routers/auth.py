from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import LoginRequest, Token
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new student, examiner, or initial admin."""
    # Check for existing email
    stmt = select(User).where(User.email == user_in.email.lower().strip())
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    # Public Admin self-registration guard
    if user_in.role == UserRole.ADMIN:
        stmt_admin = select(User).where(User.role == UserRole.ADMIN)
        admin_exists = await db.execute(stmt_admin)
        if admin_exists.scalars().first() is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Public administrator registration is disabled. Administrator accounts must be provisioned by an existing administrator."
            )

    # Determine approval status:
    # Students are automatically approved.
    # Examiners are created in PENDING status requiring admin review.
    # Initial admin (if allowed) is APPROVED.
    if user_in.role == UserRole.EXAMINER:
        approval_status = ApprovalStatus.PENDING
    else:
        approval_status = ApprovalStatus.APPROVED

    # Hash password securely
    hashed_pwd = hash_password(user_in.password)

    user = User(
        name=user_in.name.strip(),
        email=user_in.email.lower().strip(),
        password_hash=hashed_pwd,
        role=user_in.role,
        approval_status=approval_status,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Log registration in audit log
    audit = AuditLog(
        user_id=user.id,
        action="USER_REGISTERED",
        details=f"User {user.email} registered with role {user.role.value} (status: {user.approval_status.value})",
    )
    db.add(audit)

    await db.commit()
    await db.refresh(user)
    return user

@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate user and receive JWT access token"
)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via email and password with approval verification."""
    stmt = select(User).where(User.email == credentials.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check account approval status
    if user.role == UserRole.EXAMINER:
        if user.approval_status == ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your examiner account is waiting for administrator approval.",
            )
        if user.approval_status == ApprovalStatus.REJECTED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your examiner registration was rejected. Please contact the administrator.",
            )

    if user.approval_status != ApprovalStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not approved. Please contact an administrator.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact an administrator."
        )

    # Create JWT
    role_str = user.role.value if isinstance(user.role, UserRole) else str(user.role)
    token_data = {
        "sub": str(user.id),
        "role": role_str,
    }
    access_token = create_access_token(data=token_data)

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user=UserResponse.model_validate(user),
    )

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile"
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return profile of currently authenticated user."""
    return current_user

# Role-specific verification routes
@router.get(
    "/test-student",
    summary="Test student role access"
)
async def test_student_access(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    return {"message": f"Hello Student {current_user.name}", "role": current_user.role}

@router.get(
    "/test-examiner",
    summary="Test examiner role access"
)
async def test_examiner_access(
    current_user: User = Depends(require_role(UserRole.EXAMINER)),
):
    return {"message": f"Hello Examiner {current_user.name}", "role": current_user.role}

@router.get(
    "/test-admin",
    summary="Test admin role access"
)
async def test_admin_access(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return {"message": f"Hello Admin {current_user.name}", "role": current_user.role}
