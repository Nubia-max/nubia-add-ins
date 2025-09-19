import { Router } from 'express';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import ExcelAgentService from '../services/ExcelAgentService';
import ExcelDeepSeekService from '../services/ExcelDeepSeekService';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();
const excelAgent = new ExcelAgentService();
const excelDeepSeek = new ExcelDeepSeekService();

// Analyze Excel file endpoint
router.post('/analyze', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    logger.info(`Analyzing Excel file for user ${userId}: ${filePath}`);

    // Validate file exists and is accessible
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found or not accessible' });
    }

    // Validate file type
    const extension = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(extension)) {
      return res.status(400).json({ error: 'Unsupported file type. Only .xlsx, .xls, and .csv files are supported.' });
    }

    // Analyze the file
    const analysis = await excelAgent.analyzeExcelFile(filePath);

    // Start file monitoring for this user
    await excelAgent.startFileMonitoring(filePath, userId);

    logger.info(`Excel analysis completed for ${filePath}: ${analysis.sheets.length} sheets, ${analysis.formulas.length} formulas`);

    res.json({
      success: true,
      analysis,
      message: 'File analyzed successfully'
    });

  } catch (error) {
    logger.error('Error analyzing Excel file:', error);
    res.status(500).json({
      error: 'Failed to analyze Excel file',
      message: error.message
    });
  }
});

// Edit Excel file endpoint
router.post('/edit', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath, command, fileContext } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath || !command) {
      return res.status(400).json({ error: 'File path and command are required' });
    }

    logger.info(`Processing Excel edit command for user ${userId}: ${command.substring(0, 100)}`);

    // Validate command
    const commandValidation = excelDeepSeek.validateCommand(command);
    if (!commandValidation.valid) {
      return res.status(400).json({ error: commandValidation.message });
    }

    // Validate file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found or not accessible' });
    }

    // Use DeepSeek to analyze the command
    const aiAnalysis = await excelDeepSeek.analyzeExcelCommand({
      command,
      fileContext,
      previousCommands: [] // TODO: Add session tracking
    });

    // Validate operations before execution
    const operationWarnings = excelDeepSeek.validateOperations(aiAnalysis.operations, fileContext);
    if (operationWarnings.length > 0) {
      logger.warn('Operation validation warnings:', operationWarnings);
    }

    // Execute the edit
    const result = await excelAgent.editExcelFile(filePath, command, fileContext, aiAnalysis);

    if (result.success) {
      // File editing completed successfully
      // The frontend will handle auto-opening via Electron IPC
      logger.info(`Excel file edited successfully: ${filePath}`);
    }

    res.json({
      success: result.success,
      result,
      aiAnalysis: {
        reasoning: aiAnalysis.reasoning,
        summary: aiAnalysis.summary,
        confidence: aiAnalysis.confidence,
        warnings: [...(aiAnalysis.warnings || []), ...operationWarnings],
        suggestions: aiAnalysis.suggestions
      },
      message: result.message
    });

  } catch (error) {
    logger.error('Error editing Excel file:', error);
    res.status(500).json({
      error: 'Failed to edit Excel file',
      message: error.message
    });
  }
});

// Interpret vague command endpoint
router.post('/interpret', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { command, fileContext } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    logger.info(`Interpreting vague Excel command for user ${userId}: ${command}`);

    // Use DeepSeek to interpret the vague command
    const interpretation = await excelDeepSeek.interpretVagueCommand(command, fileContext);

    res.json({
      success: true,
      interpretation,
      message: 'Command interpreted successfully'
    });

  } catch (error) {
    logger.error('Error interpreting command:', error);
    res.status(500).json({
      error: 'Failed to interpret command',
      message: error.message
    });
  }
});

// Complex analysis endpoint
router.post('/analyze-complex', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath, analysisType, fileContext } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath || !analysisType) {
      return res.status(400).json({ error: 'File path and analysis type are required' });
    }

    logger.info(`Performing complex analysis for user ${userId}: ${analysisType} on ${filePath}`);

    // Validate file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found or not accessible' });
    }

    // Perform complex analysis
    const analysis = await excelAgent.performComplexAnalysis(filePath, analysisType, fileContext);

    res.json({
      success: true,
      analysis,
      message: 'Complex analysis completed successfully'
    });

  } catch (error) {
    logger.error('Error in complex analysis:', error);
    res.status(500).json({
      error: 'Failed to perform complex analysis',
      message: error.message
    });
  }
});

// File monitoring control endpoints
router.post('/monitor/start', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    await excelAgent.startFileMonitoring(filePath, userId);

    res.json({
      success: true,
      message: 'File monitoring started'
    });

  } catch (error) {
    logger.error('Error starting file monitoring:', error);
    res.status(500).json({
      error: 'Failed to start file monitoring',
      message: error.message
    });
  }
});

router.post('/monitor/stop', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    await excelAgent.stopFileMonitoring(filePath);

    res.json({
      success: true,
      message: 'File monitoring stopped'
    });

  } catch (error) {
    logger.error('Error stopping file monitoring:', error);
    res.status(500).json({
      error: 'Failed to stop file monitoring',
      message: error.message
    });
  }
});

// Backup management endpoints
router.get('/backups/:filePath', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Decode the file path
    const decodedFilePath = decodeURIComponent(filePath);

    // List backups for this file
    const backupDir = path.dirname(decodedFilePath);
    const fileName = path.basename(decodedFilePath, path.extname(decodedFilePath));
    const extension = path.extname(decodedFilePath);

    try {
      const files = await fs.readdir(backupDir);
      const backups = files
        .filter(file => file.startsWith(`${fileName}.backup.`) && file.endsWith(extension))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          created: file.match(/\.backup\.(.+)\./)?.[1] || 'unknown'
        }))
        .sort((a, b) => b.created.localeCompare(a.created));

      res.json({
        success: true,
        backups,
        message: `Found ${backups.length} backup(s)`
      });

    } catch (error) {
      res.json({
        success: true,
        backups: [],
        message: 'No backups found'
      });
    }

  } catch (error) {
    logger.error('Error listing backups:', error);
    res.status(500).json({
      error: 'Failed to list backups',
      message: error.message
    });
  }
});

// Restore from backup endpoint
router.post('/restore', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const { filePath, backupPath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!filePath || !backupPath) {
      return res.status(400).json({ error: 'File path and backup path are required' });
    }

    logger.info(`Restoring file from backup for user ${userId}: ${backupPath} -> ${filePath}`);

    // Validate backup exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    // Create a backup of current file before restoring
    const preRestoreBackup = `${filePath}.pre-restore.${new Date().toISOString().replace(/[:.]/g, '-')}${path.extname(filePath)}`;
    try {
      await fs.copyFile(filePath, preRestoreBackup);
    } catch (error) {
      logger.warn('Could not create pre-restore backup:', error);
    }

    // Restore from backup
    await fs.copyFile(backupPath, filePath);

    res.json({
      success: true,
      message: 'File restored from backup successfully',
      preRestoreBackup: preRestoreBackup
    });

  } catch (error) {
    logger.error('Error restoring from backup:', error);
    res.status(500).json({
      error: 'Failed to restore from backup',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Excel Agent API',
    timestamp: new Date().toISOString(),
    features: [
      'File Analysis',
      'Command Interpretation',
      'Excel Editing',
      'File Monitoring',
      'Backup Management',
      'Complex Analysis'
    ]
  });
});

export default router;