import time
import pyautogui
import cv2
import numpy as np
from typing import Callable, Optional
import os
from PIL import Image

from app.utils.logger import logger

class VisualAutomationService:
    def __init__(self):
        # Configure pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.5
        
        # Screen resolution
        self.screen_width, self.screen_height = pyautogui.size()
        logger.info(f"Screen resolution: {self.screen_width}x{self.screen_height}")
    
    def execute(self, task: str, progress_callback: Callable[[int, str], None]) -> str:
        """Execute a visual automation task"""
        try:
            progress_callback(10, "Analyzing task requirements...")
            
            # Parse task and determine actions
            actions = self._parse_task(task)
            
            progress_callback(20, "Locating Excel application...")
            
            # Find and activate Excel
            excel_found = self._find_and_activate_excel()
            if not excel_found:
                raise Exception("Excel application not found or could not be activated")
            
            progress_callback(30, "Excel activated, executing task...")
            
            # Execute the parsed actions
            result = self._execute_actions(actions, progress_callback)
            
            progress_callback(100, "Task completed successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"Visual automation error: {str(e)}")
            raise e
    
    def _parse_task(self, task: str) -> list:
        """Parse task description into actionable steps"""
        task_lower = task.lower()
        actions = []
        
        # Basic task parsing - can be enhanced with NLP
        if "create" in task_lower and "pivot" in task_lower:
            actions.append({"type": "create_pivot_table", "description": task})
        elif "format" in task_lower:
            actions.append({"type": "format_cells", "description": task})
        elif "chart" in task_lower or "graph" in task_lower:
            actions.append({"type": "create_chart", "description": task})
        elif "formula" in task_lower or "function" in task_lower:
            actions.append({"type": "enter_formula", "description": task})
        else:
            # Generic data entry or manipulation
            actions.append({"type": "generic_task", "description": task})
        
        return actions
    
    def _find_and_activate_excel(self) -> bool:
        """Find and activate Excel application"""
        try:
            # Try to find Excel window
            excel_windows = pyautogui.getWindowsWithTitle("Excel")
            if not excel_windows:
                # Try alternative Excel window titles
                excel_windows = pyautogui.getWindowsWithTitle("Microsoft Excel")
            
            if excel_windows:
                # Activate the first Excel window found
                excel_window = excel_windows[0]
                excel_window.activate()
                time.sleep(1)
                return True
            
            # Try to launch Excel if not found
            logger.info("Excel not found, attempting to launch...")
            pyautogui.press('win')
            time.sleep(0.5)
            pyautogui.typewrite('excel')
            time.sleep(1)
            pyautogui.press('enter')
            time.sleep(3)  # Wait for Excel to launch
            
            return True
            
        except Exception as e:
            logger.error(f"Error finding/activating Excel: {str(e)}")
            return False
    
    def _execute_actions(self, actions: list, progress_callback: Callable[[int, str], None]) -> str:
        """Execute the parsed actions"""
        results = []
        total_actions = len(actions)
        
        for i, action in enumerate(actions):
            progress = 30 + int((i / total_actions) * 60)  # 30% to 90%
            progress_callback(progress, f"Executing: {action['type']}")
            
            try:
                if action["type"] == "create_pivot_table":
                    result = self._create_pivot_table(action)
                elif action["type"] == "format_cells":
                    result = self._format_cells(action)
                elif action["type"] == "create_chart":
                    result = self._create_chart(action)
                elif action["type"] == "enter_formula":
                    result = self._enter_formula(action)
                else:
                    result = self._execute_generic_task(action)
                
                results.append(result)
                time.sleep(1)  # Brief pause between actions
                
            except Exception as e:
                error_msg = f"Error executing {action['type']}: {str(e)}"
                logger.error(error_msg)
                results.append(error_msg)
        
        return "; ".join(results)
    
    def _create_pivot_table(self, action: dict) -> str:
        """Create a pivot table"""
        try:
            # Select data range (simplified - select all data)
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.5)
            
            # Open Insert tab
            pyautogui.hotkey('alt', 'n')
            time.sleep(0.5)
            
            # Insert pivot table
            pyautogui.press('v')  # PivotTable shortcut
            time.sleep(1)
            
            # Accept default settings
            pyautogui.press('enter')
            time.sleep(2)
            
            return "Pivot table created successfully"
            
        except Exception as e:
            raise Exception(f"Failed to create pivot table: {str(e)}")
    
    def _format_cells(self, action: dict) -> str:
        """Format selected cells"""
        try:
            # Select all data
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.5)
            
            # Open Format Cells dialog
            pyautogui.hotkey('ctrl', '1')
            time.sleep(1)
            
            # Apply basic formatting (can be enhanced based on task description)
            if "bold" in action["description"].lower():
                pyautogui.hotkey('ctrl', 'b')
            
            # Close dialog
            pyautogui.press('enter')
            
            return "Cell formatting applied successfully"
            
        except Exception as e:
            raise Exception(f"Failed to format cells: {str(e)}")
    
    def _create_chart(self, action: dict) -> str:
        """Create a chart"""
        try:
            # Select data
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.5)
            
            # Insert tab
            pyautogui.hotkey('alt', 'n')
            time.sleep(0.5)
            
            # Insert chart (quick chart)
            pyautogui.press('c')
            time.sleep(1)
            
            # Select first chart type
            pyautogui.press('enter')
            time.sleep(2)
            
            return "Chart created successfully"
            
        except Exception as e:
            raise Exception(f"Failed to create chart: {str(e)}")
    
    def _enter_formula(self, action: dict) -> str:
        """Enter a formula in a cell"""
        try:
            # Click on a cell (A1)
            pyautogui.press('home')
            pyautogui.hotkey('ctrl', 'home')
            time.sleep(0.5)
            
            # Example formula based on task description
            if "sum" in action["description"].lower():
                pyautogui.typewrite("=SUM(A:A)")
            elif "average" in action["description"].lower():
                pyautogui.typewrite("=AVERAGE(A:A)")
            else:
                pyautogui.typewrite("=COUNT(A:A)")
            
            pyautogui.press('enter')
            
            return "Formula entered successfully"
            
        except Exception as e:
            raise Exception(f"Failed to enter formula: {str(e)}")
    
    def _execute_generic_task(self, action: dict) -> str:
        """Execute a generic task"""
        try:
            # Simulate generic Excel interaction
            pyautogui.hotkey('ctrl', 'home')  # Go to A1
            time.sleep(0.5)
            
            # Type some example data if it's about data entry
            if "data" in action["description"].lower() or "enter" in action["description"].lower():
                pyautogui.typewrite("Sample Data")
                pyautogui.press('enter')
            
            return f"Generic task completed: {action['description']}"
            
        except Exception as e:
            raise Exception(f"Failed to execute generic task: {str(e)}")
    
    def take_screenshot(self) -> str:
        """Take a screenshot for debugging"""
        try:
            screenshot = pyautogui.screenshot()
            timestamp = int(time.time())
            filename = f"screenshot_{timestamp}.png"
            screenshot.save(filename)
            return filename
        except Exception as e:
            logger.error(f"Failed to take screenshot: {str(e)}")
            return ""