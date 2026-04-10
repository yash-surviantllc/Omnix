from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.messages import ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.chatbot.tools import get_all_tools
from app.chatbot.prompts import build_system_prompt
import logging

logger = logging.getLogger(__name__)


# ==========================================
# STATE DEFINITION
# ==========================================

class ChatState(TypedDict):
    """State that flows through the graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_name: str
    user_roles: list
    worker_modules: list
    module_context: str


# ==========================================
# MODEL INITIALIZATION
# ==========================================

def get_model():
    """Initialize the LLM with tools bound."""
    tools = get_all_tools()

    # Gemini Flash via LangChain — swap this one line to change models
    # For Claude: from langchain_anthropic import ChatAnthropic
    #             llm = ChatAnthropic(model="claude-3-5-haiku-20241022")
    # For GPT:   from langchain_openai import ChatOpenAI
    #             llm = ChatOpenAI(model="gpt-4o-mini")
    
    llm = ChatGoogleGenerativeAI(
        model=settings.CHATBOT_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0,
    )

    # Bind tools to the model — LangChain converts to provider-specific format
    llm_with_tools = llm.bind_tools(tools)

    return llm_with_tools


# ==========================================
# NODE FUNCTIONS
# ==========================================

def chatbot_node(state: ChatState) -> dict:
    """
    Node 1: Call the LLM.
    Takes conversation history, calls the model.
    Model either responds with text OR requests a tool call.
    """
    # Build system prompt from user context
    system_prompt = build_system_prompt(
        user_name=state.get("user_name", "User"),
        user_roles=state.get("user_roles", []),
        worker_modules=state.get("worker_modules", []),
        module_context=state.get("module_context"),
    )

    # Prepend system message to conversation
    system_msg = SystemMessage(content=system_prompt)
    
    # Get messages — filter out any existing system messages to avoid duplication
    conversation = [
        msg for msg in state["messages"]
        if not isinstance(msg, SystemMessage)
    ]

    all_messages = [system_msg] + list(conversation)

    # Trim conversation if too long (keep system + last 20 messages)
    MAX_HISTORY = 20
    if len(all_messages) > MAX_HISTORY + 1:  # +1 for system message
        all_messages = [all_messages[0]] + list(all_messages[-(MAX_HISTORY):])

    # Call the model
    model = get_model()
    
    try:
        response = model.invoke(all_messages)
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        # Return a graceful error message instead of crashing
        error_msg = AIMessage(
            content="I'm sorry, I'm having trouble processing that right now. Could you try rephrasing your question?"
        )
        return {"messages": [error_msg]}

    return {"messages": [response]}


def should_continue(state: ChatState) -> str:
    """
    Conditional edge: decide whether to call tools or finish.
    
    If the last message has tool_calls → route to "tools" node.
    Otherwise → route to END.
    """
    last_message = state["messages"][-1]

    # Check if the LLM wants to call tools
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    
    return "end"


# ==========================================
# BUILD THE GRAPH
# ==========================================

def build_chat_graph():
    """
    Build and compile the LangGraph.
    
    Graph structure:
    
        [chatbot] ---(has tool calls)---> [tools] ----> [chatbot]
            |
            +-------(no tool calls)----> [END]
    
    Simple two-node loop. No agents, no planning — just tool calling.
    """
    tools = get_all_tools()

    # Create the tool execution node (LangGraph built-in)
    tool_node = ToolNode(tools)

    # Build the state graph
    graph = StateGraph(ChatState)

    # Add nodes
    graph.add_node("chatbot", chatbot_node)
    graph.add_node("tools", tool_node)

    # Set entry point
    graph.set_entry_point("chatbot")

    # Add conditional edge from chatbot
    graph.add_conditional_edges(
        "chatbot",
        should_continue,
        {
            "tools": "tools",   # If tool calls exist → execute tools
            "end": END,         # If no tool calls → finish
        },
    )

    # After tools execute, always go back to chatbot (so it can read results)
    graph.add_edge("tools", "chatbot")

    # Compile
    compiled = graph.compile()
    
    logger.info("Chat graph compiled successfully")
    return compiled


# ==========================================
# SINGLETON — compile once, reuse
# ==========================================

_graph = None

def get_chat_graph():
    """Get or create the compiled chat graph. Singleton pattern."""
    global _graph
    if _graph is None:
        _graph = build_chat_graph()
    return _graph