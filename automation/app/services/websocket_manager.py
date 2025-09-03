from fastapi import WebSocket
from typing import List, Dict, Any
import json
import asyncio
from app.utils.logger import logger

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection",
            "message": "Connected to Nubia Automation Service",
            "status": "connected"
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: Dict[Any, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            if websocket in self.active_connections:
                await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")
            # Remove connection if it's broken
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[Any, Any]):
        """Broadcast a message to all connected WebSocket clients"""
        if not self.active_connections:
            return
        
        message_text = json.dumps(message)
        disconnected = []
        
        # Send to all connections
        for connection in self.active_connections:
            try:
                await connection.send_text(message_text)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {str(e)}")
                disconnected.append(connection)
        
        # Remove broken connections
        for connection in disconnected:
            self.disconnect(connection)
        
        if self.active_connections:
            logger.info(f"Message broadcasted to {len(self.active_connections)} connections")
    
    async def send_task_update(self, task_id: str, status: str, **kwargs):
        """Send a task update to all connected clients"""
        message = {
            "type": "task_update",
            "task_id": task_id,
            "status": status,
            "timestamp": asyncio.get_event_loop().time(),
            **kwargs
        }
        await self.broadcast(message)
    
    async def send_progress_update(self, task_id: str, progress: int, message: str = ""):
        """Send a progress update for a specific task"""
        update = {
            "type": "progress_update",
            "task_id": task_id,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(update)
    
    async def send_error(self, task_id: str, error: str):
        """Send an error message for a specific task"""
        error_message = {
            "type": "error",
            "task_id": task_id,
            "error": error,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(error_message)
    
    async def send_completion(self, task_id: str, result: str):
        """Send a completion message for a specific task"""
        completion_message = {
            "type": "completion",
            "task_id": task_id,
            "result": result,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(completion_message)
    
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.active_connections)
    
    async def ping_connections(self):
        """Ping all connections to check if they're still alive"""
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.ping()
            except Exception as e:
                logger.warning(f"Connection ping failed: {str(e)}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def send_system_notification(self, message: str, level: str = "info"):
        """Send a system notification to all connected clients"""
        notification = {
            "type": "system_notification",
            "message": message,
            "level": level,  # info, warning, error, success
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(notification)