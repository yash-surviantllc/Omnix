from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from langchain_core.messages import HumanMessage, AIMessage
from app.database import get_db
from app.chatbot.graph import get_chat_graph
from app.chatbot.schemas import ChatRequest, ChatResponse, ChatMessage
import logging

logger = logging.getLogger(__name__)


class ChatService:
    """
    Manages chat sessions and runs the LangGraph.
    
    Responsibilities:
    - Create / load conversation sessions from Supabase
    - Convert stored messages to LangChain format
    - Run the graph and extract the reply
    - Persist new messages back to the database
    """

    # ==========================================
    # SESSION MANAGEMENT
    # ==========================================

    @staticmethod
    async def get_or_create_session(
        session_id: Optional[str],
        user_id: str,
        module_context: Optional[str] = None,
    ) -> str:
        """
        Get existing session or create a new one.
        Returns the session_id.
        """
        db = get_db()

        if session_id:
            # Verify session exists and belongs to this user
            result = db.table('chat_sessions').select('id').eq(
                'id', session_id
            ).eq('user_id', user_id).execute()

            if result.data:
                # Update last_active and module_context
                update_data = {'last_active': datetime.utcnow().isoformat()}
                if module_context:
                    update_data['module_context'] = module_context
                db.table('chat_sessions').update(update_data).eq('id', session_id).execute()
                return session_id

            # Session not found or doesn't belong to user — create new
            logger.warning(f"Session {session_id} not found for user {user_id}, creating new")

        # Create new session
        new_id = str(uuid4())
        db.table('chat_sessions').insert({
            'id': new_id,
            'user_id': user_id,
            'module_context': module_context,
            'last_active': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
        }).execute()

        logger.info(f"Created new chat session {new_id} for user {user_id}")
        return new_id

    @staticmethod
    async def load_history(session_id: str) -> List[dict]:
        """
        Load conversation history from the database.
        Returns list of LangChain-compatible message dicts.
        """
        db = get_db()

        result = db.table('chat_messages').select(
            'role, content'
        ).eq(
            'session_id', session_id
        ).order('created_at').execute()

        messages = []
        for row in result.data:
            if row['role'] == 'user':
                messages.append(HumanMessage(content=row['content']))
            elif row['role'] == 'assistant':
                messages.append(AIMessage(content=row['content']))

        return messages

    @staticmethod
    async def save_message(session_id: str, role: str, content: str):
        """Save a single message to the database."""
        db = get_db()

        db.table('chat_messages').insert({
            'id': str(uuid4()),
            'session_id': session_id,
            'role': role,
            'content': content,
            'created_at': datetime.utcnow().isoformat(),
        }).execute()

    # ==========================================
    # MAIN CHAT METHOD
    # ==========================================

    @staticmethod
    async def chat(
        request: ChatRequest,
        user_id: str,
        user_name: str,
        user_roles: List[str],
        worker_modules: Optional[List[str]] = None,
    ) -> ChatResponse:
        """
        Process a chat message end-to-end.
        
        Flow:
        1. Get or create session
        2. Load conversation history
        3. Append user message
        4. Run LangGraph
        5. Extract reply and tool sources
        6. Persist messages
        7. Return response
        """

        # 1. Session
        session_id = await ChatService.get_or_create_session(
            session_id=request.session_id,
            user_id=user_id,
            module_context=request.module_context,
        )

        # 2. Load history
        history = await ChatService.load_history(session_id)

        # 3. Append new user message
        user_msg = HumanMessage(content=request.message)
        all_messages = list(history) + [user_msg]

        # 4. Build graph input state
        graph_input = {
            "messages": all_messages,
            "user_name": user_name,
            "user_roles": user_roles,
            "worker_modules": worker_modules or [],
            "module_context": request.module_context or "",
        }

        # 5. Run the graph
        graph = get_chat_graph()

        try:
            result = graph.invoke(graph_input)
        except Exception as e:
            logger.error(f"Graph execution failed: {e}")
            # Save user message even if graph fails
            await ChatService.save_message(session_id, "user", request.message)
            return ChatResponse(
                reply="I'm having trouble right now. Please try again in a moment.",
                session_id=session_id,
                sources=None,
            )

        # 6. Extract the final AI reply and sources
        reply_text = ""
        sources = []

        # Walk through result messages to find the final AI response and any tools used
        for msg in result["messages"]:
            # Collect tool names that were called
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_name = tc.get("name") or tc.get("function", {}).get("name", "")
                    if tool_name and tool_name not in sources:
                        sources.append(tool_name)

        # The last AI message (non-tool) is the final reply
        # The last AI message (non-tool) is the final reply
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage) and msg.content:
                # Skip messages that are purely tool calls with no text content
                content = msg.content

                # Handle Gemini returning content as list of blocks
                # e.g. [{"type": "text", "text": "actual reply"}]
                if isinstance(content, list):
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("text"):
                            text_parts.append(block["text"])
                        elif isinstance(block, str):
                            text_parts.append(block)
                    content = "\n".join(text_parts)

                if isinstance(content, str) and content.strip():
                    reply_text = content
                    break

        if not reply_text:
            reply_text = "I couldn't generate a response. Could you rephrase your question?"

        # 7. Persist both messages
        await ChatService.save_message(session_id, "user", request.message)
        await ChatService.save_message(session_id, "assistant", reply_text)

        return ChatResponse(
            reply=reply_text,
            session_id=session_id,
            sources=sources if sources else None,
        )

    # ==========================================
    # UTILITY METHODS
    # ==========================================

    @staticmethod
    async def get_session_history(session_id: str, user_id: str) -> List[ChatMessage]:
        """
        Get full conversation history for a session.
        Used if frontend wants to reload a past conversation.
        """
        db = get_db()

        # Verify ownership
        session = db.table('chat_sessions').select('id').eq(
            'id', session_id
        ).eq('user_id', user_id).execute()

        if not session.data:
            return []

        result = db.table('chat_messages').select(
            'role, content, created_at'
        ).eq('session_id', session_id).order('created_at').execute()

        return [
            ChatMessage(
                role=row['role'],
                content=row['content'],
                timestamp=row['created_at'],
            )
            for row in result.data
        ]

    @staticmethod
    async def list_user_sessions(user_id: str, limit: int = 20) -> list:
        """
        List recent chat sessions for a user.
        Used if you want a 'chat history' sidebar.
        """
        db = get_db()

        result = db.table('chat_sessions').select(
            'id, module_context, last_active, created_at'
        ).eq('user_id', user_id).order(
            'last_active', desc=True
        ).limit(limit).execute()

        return result.data