import logging
import sys
from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any
from loguru import logger
import sys
import json
import os
from pathlib import Path

class LoggingSettings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    LOG_FILE: str = "logs/app.log"
    LOG_FILE_ROTATION: str = "10 MB"
    LOG_FILE_RETENTION: str = "30 days"
    LOG_FILE_COMPRESSION: Optional[str] = "zip"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # This will ignore extra fields from the config

def setup_logging(config: Optional[Dict[str, Any]] = None):
    """Configure logging with Loguru"""
    # Only pass in the logging-related config values, not the entire config
    logging_config = {
        "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
        "LOG_FORMAT": os.getenv("LOG_FORMAT", LoggingSettings.__fields__["LOG_FORMAT"].default),
        "LOG_FILE": os.getenv("LOG_FILE", LoggingSettings.__fields__["LOG_FILE"].default),
        "LOG_FILE_ROTATION": os.getenv("LOG_FILE_ROTATION", LoggingSettings.__fields__["LOG_FILE_ROTATION"].default),
        "LOG_FILE_RETENTION": os.getenv("LOG_FILE_RETENTION", LoggingSettings.__fields__["LOG_FILE_RETENTION"].default),
        "LOG_FILE_COMPRESSION": os.getenv("LOG_FILE_COMPRESSION", LoggingSettings.__fields__["LOG_FILE_COMPRESSION"].default)
    }
    
    # If config is provided, update with any logging-specific settings
    if config:
        logging_config.update({k: v for k, v in config.items() if k.startswith("LOG_") or k in LoggingSettings.__fields__})
    
    settings = LoggingSettings(**logging_config)
    
    # Ensure log directory exists
    log_file = Path(settings.LOG_FILE)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure logger
    logger.remove()  # Remove default handler
    logger.add(
        sys.stderr,
        level=settings.LOG_LEVEL,
        format=settings.LOG_FORMAT,
        enqueue=True
    )
    
    if settings.LOG_FILE:
        logger.add(
            settings.LOG_FILE,
            rotation=settings.LOG_FILE_ROTATION,
            retention=settings.LOG_FILE_RETENTION,
            compression=settings.LOG_FILE_COMPRESSION,
            level=settings.LOG_LEVEL,
            format=settings.LOG_FORMAT,
            enqueue=True
        )
    
    return logger

# Initialize logger
logger = setup_logging()
