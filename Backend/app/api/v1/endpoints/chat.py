from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.chatbot.schemas import ChatRequest, ChatResponse, ChatMessage
from app.chatbot.service import ChatService
from app.api.deps import get_current_user
from app.schemas.user import UserResponse

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Send a message to the OMNIX chatbot.
    
    - **message**: Your question or request (required)
    - **session_id**: Existing session ID to continue a conversation (optional — omit for new conversation)
    - **module_context**: Which page you're on — helps the chatbot give relevant guidance (optional)
      Valid values: dashboard, bom, orders, working-order, wip, inventory, 
      transfer, material-request, qc, gate-entry, gate-exit, settings
    
    Returns the chatbot reply, session ID (save this for follow-up messages), 
    and which tools were used.
    """
    try:
        response = await ChatService.chat(
            request=request,
            user_id=str(current_user.id),
            user_name=current_user.full_name or current_user.username,
            user_roles=current_user.roles or [],
            worker_modules=current_user.worker_modules,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/history/{session_id}", response_model=List[ChatMessage])
async def get_chat_history(
    session_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Get full conversation history for a chat session.
    
    Only returns history for sessions owned by the current user.
    """
    history = await ChatService.get_session_history(
        session_id=session_id,
        user_id=str(current_user.id),
    )
    return history


@router.get("/sessions")
async def list_chat_sessions(
    limit: int = Query(20, ge=1, le=50),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    List recent chat sessions for the current user.
    
    Returns session IDs, module context, and timestamps.
    Useful for building a 'chat history' sidebar.
    """
    sessions = await ChatService.list_user_sessions(
        user_id=str(current_user.id),
        limit=limit,
    )
    return sessions