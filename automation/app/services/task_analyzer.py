import re
from typing import List, Dict
from app.models.task import TaskComplexity
from app.utils.logger import logger

class TaskAnalyzer:
    def __init__(self):
        # Keywords that indicate complex operations
        self.complex_keywords = [
            "pivot table", "pivot", "vlookup", "hlookup", "index match",
            "macro", "vba", "multiple sheets", "multiple files",
            "complex formula", "nested if", "array formula",
            "conditional formatting", "data validation",
            "import data", "export data", "merge data",
            "advanced chart", "dashboard", "automation",
            "batch process", "loop", "iterate"
        ]
        
        # Keywords that indicate simple operations
        self.simple_keywords = [
            "format", "bold", "color", "font", "align",
            "sum", "average", "count", "max", "min",
            "sort", "filter", "basic chart", "simple chart",
            "copy", "paste", "delete", "insert",
            "rename", "save", "open", "print"
        ]
        
        # Action words that might indicate multiple steps
        self.action_indicators = [
            "create and", "format and", "calculate and",
            "first", "then", "next", "after", "finally",
            "step 1", "step 2", "1.", "2.", "3."
        ]
    
    def analyze_complexity(self, task_description: str) -> TaskComplexity:
        """Analyze task complexity based on description"""
        try:
            task_lower = task_description.lower()
            
            # Calculate complexity score
            complexity_score = 0
            
            # Check for complex keywords
            complex_matches = sum(1 for keyword in self.complex_keywords if keyword in task_lower)
            complexity_score += complex_matches * 3
            
            # Check for simple keywords (negative weight for complexity)
            simple_matches = sum(1 for keyword in self.simple_keywords if keyword in task_lower)
            complexity_score -= simple_matches * 1
            
            # Check for multiple action indicators
            action_matches = sum(1 for indicator in self.action_indicators if indicator in task_lower)
            complexity_score += action_matches * 2
            
            # Check for length (longer descriptions often indicate complexity)
            word_count = len(task_description.split())
            if word_count > 20:
                complexity_score += 2
            elif word_count > 10:
                complexity_score += 1
            
            # Check for specific patterns
            complexity_score += self._check_complexity_patterns(task_lower)
            
            # Determine final complexity
            if complexity_score >= 5:
                logger.info(f"Task analyzed as COMPLEX (score: {complexity_score})")
                return TaskComplexity.COMPLEX
            else:
                logger.info(f"Task analyzed as SIMPLE (score: {complexity_score})")
                return TaskComplexity.SIMPLE
                
        except Exception as e:
            logger.error(f"Error analyzing task complexity: {str(e)}")
            # Default to simple if analysis fails
            return TaskComplexity.SIMPLE
    
    def _check_complexity_patterns(self, task_lower: str) -> int:
        """Check for specific patterns that indicate complexity"""
        complexity_points = 0
        
        # Multiple conditions or criteria
        if len(re.findall(r'\band\b|\bor\b|\bif\b|\bwhen\b|\bthen\b', task_lower)) > 2:
            complexity_points += 2
        
        # References to multiple sheets or files
        if re.search(r'sheet\d+|sheet \d+|multiple sheet|different sheet', task_lower):
            complexity_points += 2
        
        # Data manipulation patterns
        if re.search(r'transform|convert|merge|split|combine|join', task_lower):
            complexity_points += 2
        
        # Conditional logic patterns
        if re.search(r'depending on|based on|according to|if.*then', task_lower):
            complexity_points += 2
        
        # Repetitive actions
        if re.search(r'for each|all rows|every|repeat|loop|batch', task_lower):
            complexity_points += 2
        
        # Mathematical complexity
        if re.search(r'calculate.*percentage|complex calculation|formula.*formula', task_lower):
            complexity_points += 2
        
        # Formatting complexity
        if re.search(r'conditional format|dynamic format|multiple format', task_lower):
            complexity_points += 2
        
        return complexity_points
    
    def get_estimated_duration(self, complexity: TaskComplexity) -> Dict[str, int]:
        """Get estimated duration for task completion"""
        if complexity == TaskComplexity.COMPLEX:
            return {
                "visual_mode": 300,  # 5 minutes
                "background_mode": 60  # 1 minute
            }
        else:
            return {
                "visual_mode": 120,  # 2 minutes
                "background_mode": 30  # 30 seconds
            }
    
    def get_risk_factors(self, task_description: str) -> List[str]:
        """Identify potential risk factors in the task"""
        risks = []
        task_lower = task_description.lower()
        
        if "delete" in task_lower or "remove" in task_lower:
            risks.append("Data deletion - ensure backup exists")
        
        if "macro" in task_lower or "vba" in task_lower:
            risks.append("Macro execution - security implications")
        
        if "import" in task_lower or "external" in task_lower:
            risks.append("External data source - connectivity required")
        
        if "large" in task_lower or "big" in task_lower:
            risks.append("Large dataset - performance considerations")
        
        if "overwrite" in task_lower or "replace" in task_lower:
            risks.append("Data overwrite - backup recommended")
        
        return risks
    
    def suggest_prerequisites(self, task_description: str) -> List[str]:
        """Suggest prerequisites based on task description"""
        prerequisites = []
        task_lower = task_description.lower()
        
        if "excel" not in task_lower and ("spreadsheet" in task_lower or "workbook" in task_lower):
            prerequisites.append("Microsoft Excel must be installed and available")
        
        if "import" in task_lower or "data" in task_lower:
            prerequisites.append("Source data files must be accessible")
        
        if "chart" in task_lower or "graph" in task_lower:
            prerequisites.append("Data range must be properly formatted")
        
        if "pivot" in task_lower:
            prerequisites.append("Data must be in table format with headers")
        
        if "macro" in task_lower:
            prerequisites.append("Macros must be enabled in Excel")
        
        return prerequisites