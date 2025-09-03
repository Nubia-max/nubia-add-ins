import asyncio
import uuid
import time
from datetime import datetime
from typing import Dict, Optional, List
from concurrent.futures import ThreadPoolExecutor

from app.models.task import TaskStatusEnum, TaskComplexity, TaskMode
from app.services.visual_automation import VisualAutomationService  
from app.services.background_automation import BackgroundAutomationService
from app.services.task_analyzer import TaskAnalyzer
from app.utils.logger import logger

class AutomationManager:
    def __init__(self):
        self.tasks: Dict[str, Dict] = {}
        self.visual_service = VisualAutomationService()
        self.background_service = BackgroundAutomationService()
        self.task_analyzer = TaskAnalyzer()
        self.executor = ThreadPoolExecutor(max_workers=3)
        
    def analyze_task_complexity(self, task: str) -> TaskComplexity:
        """Analyze task complexity based on description"""
        return self.task_analyzer.analyze_complexity(task)
    
    def create_task(self, task: str, mode: TaskMode, complexity: TaskComplexity) -> str:
        """Create a new task and return task ID"""
        task_id = f"task_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"
        
        self.tasks[task_id] = {
            "id": task_id,
            "task": task,
            "mode": mode,
            "complexity": complexity,
            "status": TaskStatusEnum.QUEUED,
            "message": "Task created and queued",
            "progress": 0,
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Dict]:
        """Get task details by ID"""
        return self.tasks.get(task_id)
    
    def update_task(self, task_id: str, **kwargs):
        """Update task status and details"""
        if task_id in self.tasks:
            self.tasks[task_id].update(kwargs)
            self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
    
    def abort_task(self, task_id: str) -> bool:
        """Abort a running task"""
        task = self.tasks.get(task_id)
        if not task:
            return False
            
        if task["status"] in [TaskStatusEnum.QUEUED, TaskStatusEnum.RUNNING]:
            self.update_task(
                task_id,
                status=TaskStatusEnum.ABORTED,
                message="Task aborted by user"
            )
            return True
        
        return False
    
    def get_active_task_count(self) -> int:
        """Get number of active (queued or running) tasks"""
        return sum(1 for task in self.tasks.values() 
                  if task["status"] in [TaskStatusEnum.QUEUED, TaskStatusEnum.RUNNING])
    
    def get_active_tasks(self) -> List[Dict]:
        """Get list of active tasks"""
        return [task for task in self.tasks.values() 
                if task["status"] in [TaskStatusEnum.QUEUED, TaskStatusEnum.RUNNING]]
    
    def get_completed_tasks(self) -> List[Dict]:
        """Get list of completed tasks"""
        return [task for task in self.tasks.values() 
                if task["status"] in [TaskStatusEnum.COMPLETED, TaskStatusEnum.FAILED, TaskStatusEnum.ABORTED]]
    
    async def execute_task(self, task_id: str, websocket_manager=None):
        """Execute a task asynchronously"""
        task = self.tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return
        
        try:
            # Update status to running
            self.update_task(
                task_id,
                status=TaskStatusEnum.RUNNING,
                message="Task execution started",
                progress=0
            )
            
            # Notify via WebSocket
            if websocket_manager:
                await websocket_manager.broadcast({
                    "task_id": task_id,
                    "status": "running",
                    "message": "Task execution started"
                })
            
            logger.info(f"Starting execution of task {task_id} in {task['mode']} mode")
            
            # Choose service based on mode
            if task["mode"] == TaskMode.VISUAL:
                result = await self._execute_visual_task(task_id, task, websocket_manager)
            else:
                result = await self._execute_background_task(task_id, task, websocket_manager)
            
            # Update task as completed
            self.update_task(
                task_id,
                status=TaskStatusEnum.COMPLETED,
                message="Task completed successfully",
                progress=100,
                result=result
            )
            
            # Notify completion
            if websocket_manager:
                await websocket_manager.broadcast({
                    "task_id": task_id,
                    "status": "completed",
                    "message": "Task completed successfully",
                    "result": result
                })
            
            logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Task {task_id} failed: {error_msg}")
            
            # Update task as failed
            self.update_task(
                task_id,
                status=TaskStatusEnum.FAILED,
                message="Task execution failed",
                error=error_msg
            )
            
            # Notify failure
            if websocket_manager:
                await websocket_manager.broadcast({
                    "task_id": task_id,
                    "status": "failed",
                    "message": "Task execution failed",
                    "error": error_msg
                })
    
    async def _execute_visual_task(self, task_id: str, task: Dict, websocket_manager=None) -> str:
        """Execute task in visual mode using pyautogui"""
        loop = asyncio.get_event_loop()
        
        # Progress callback for visual mode
        def progress_callback(progress: int, message: str = ""):
            self.update_task(task_id, progress=progress, message=message)
            if websocket_manager:
                asyncio.create_task(websocket_manager.broadcast({
                    "task_id": task_id,
                    "progress": progress,
                    "message": message
                }))
        
        # Execute in thread pool to avoid blocking
        result = await loop.run_in_executor(
            self.executor,
            self.visual_service.execute,
            task["task"],
            progress_callback
        )
        
        return result
    
    async def _execute_background_task(self, task_id: str, task: Dict, websocket_manager=None) -> str:
        """Execute task in background mode using openpyxl"""
        loop = asyncio.get_event_loop()
        
        # Progress callback for background mode
        def progress_callback(progress: int, message: str = ""):
            self.update_task(task_id, progress=progress, message=message)
            if websocket_manager:
                asyncio.create_task(websocket_manager.broadcast({
                    "task_id": task_id,
                    "progress": progress,
                    "message": message
                }))
        
        # Execute in thread pool
        result = await loop.run_in_executor(
            self.executor,
            self.background_service.execute,
            task["task"],
            progress_callback
        )
        
        return result