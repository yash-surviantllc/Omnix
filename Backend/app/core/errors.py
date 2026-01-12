from fastapi import HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union
import logging

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: Optional[Dict[str, Any]] = None

class APIError(Exception):
    """Base exception for API errors"""
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        detail: Optional[Dict[str, Any]] = None
    ):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.detail = detail
        super().__init__(self.message)

# Specific error types
class NotFoundError(APIError):
    """Raised when a requested resource is not found"""
    def __init__(self, resource: str, detail: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="not_found",
            message=f"{resource} not found",
            detail=detail
        )

class ValidationError(APIError):
    """Raised when request validation fails"""
    def __init__(self, detail: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="validation_error",
            message="Validation error",
            detail=detail
        )

class UnauthorizedError(APIError):
    """Raised when authentication fails or user doesn't have permission"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="unauthorized",
            message=message
        )

class ForbiddenError(APIError):
    """Raised when user doesn't have permission to access a resource"""
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="forbidden",
            message=message
        )

class ConflictError(APIError):
    """Raised when there's a conflict with the current state of the resource"""
    def __init__(self, message: str, detail: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="conflict",
            message=message,
            detail=detail
        )

class DatabaseError(APIError):
    """Raised when there's a database error"""
    def __init__(self, message: str = "Database error occurred"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="database_error",
            message=message
        )

class ExternalServiceError(APIError):
    """Raised when an external service fails"""
    def __init__(self, service: str, error: Union[str, Exception]):
        error_msg = str(error) if isinstance(error, Exception) else error
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="external_service_error",
            message=f"Error communicating with {service}: {error_msg}"
        )

class RateLimitExceededError(APIError):
    """Raised when rate limit is exceeded"""
    def __init__(self, retry_after: Optional[int] = None):
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        detail = {"retry_after": retry_after} if retry_after else None
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="rate_limit_exceeded",
            message="Too many requests, please try again later",
            detail=detail
        )
        self.headers = headers

# Global exception handler
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for the FastAPI app"""
    if isinstance(exc, APIError):
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error_code=exc.error_code,
                message=exc.message,
                detail=exc.detail
            ).dict()
        )

    # Handle validation errors from Pydantic
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                error_code="validation_error",
                message="Request validation failed",
                detail={"errors": exc.errors()}
            ).dict()
        )

    # Handle HTTP exceptions
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error_code="http_error",
                message=exc.detail
            ).dict()
        )

    # Log unexpected errors
    logger = logging.getLogger(__name__)
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)

    # Return generic 500 error for unexpected errors
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error_code="internal_server_error",
            message="An unexpected error occurred",
            detail={"error": str(exc)} if str(exc) else None
        ).dict()
    )

# Helper function to register the global exception handler
def setup_exception_handlers(app):
    """Register the global exception handler with the FastAPI app"""
    from fastapi import FastAPI
    app.add_exception_handler(APIError, global_exception_handler)
    app.add_exception_handler(RequestValidationError, global_exception_handler)
    app.add_exception_handler(HTTPException, global_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)