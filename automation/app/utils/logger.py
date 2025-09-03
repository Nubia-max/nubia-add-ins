import logging
import sys
import os
from datetime import datetime
from pathlib import Path

# Create logs directory if it doesn't exist
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Configure logging
def setup_logger(name: str = "nubia-automation") -> logging.Logger:
    logger = logging.getLogger(name)
    
    # Don't add handlers if they already exist
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler for all logs
    file_handler = logging.FileHandler(
        log_dir / "automation.log",
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Error file handler
    error_handler = logging.FileHandler(
        log_dir / "error.log",
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    logger.addHandler(error_handler)
    
    # Prevent duplicate logging
    logger.propagate = False
    
    return logger

# Create default logger instance
logger = setup_logger()

class TaskLogger:
    """Logger specifically for task execution"""
    
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.logger = setup_logger(f"task-{task_id}")
    
    def info(self, message: str):
        self.logger.info(f"[{self.task_id}] {message}")
    
    def error(self, message: str):
        self.logger.error(f"[{self.task_id}] {message}")
    
    def warning(self, message: str):
        self.logger.warning(f"[{self.task_id}] {message}")
    
    def debug(self, message: str):
        self.logger.debug(f"[{self.task_id}] {message}")

def log_task_start(task_id: str, task_description: str, mode: str):
    """Log the start of a task"""
    logger.info(f"TASK_START - ID: {task_id}, Mode: {mode}, Description: {task_description}")

def log_task_completion(task_id: str, result: str, duration: float):
    """Log the completion of a task"""
    logger.info(f"TASK_COMPLETE - ID: {task_id}, Duration: {duration:.2f}s, Result: {result}")

def log_task_error(task_id: str, error: str, duration: float):
    """Log a task error"""
    logger.error(f"TASK_ERROR - ID: {task_id}, Duration: {duration:.2f}s, Error: {error}")

def log_api_request(endpoint: str, method: str, client_ip: str = "unknown"):
    """Log API requests"""
    logger.info(f"API_REQUEST - {method} {endpoint} from {client_ip}")

def log_websocket_event(event: str, client_count: int):
    """Log WebSocket events"""
    logger.info(f"WEBSOCKET - {event}, Active connections: {client_count}")