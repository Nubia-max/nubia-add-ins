import { Router, Request, Response } from 'express';
// import { excelService } from '../services/excelService'; // TODO: Create excelService or use existing services
import { auth } from '../middleware/auth';

const router = Router();

router.post('/process-transactions', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { transactions } = req.body;
    
    if (!transactions) {
      return res.status(400).json({ error: 'Transactions data is required' });
    }

    // const result = await excelService.processTransactions(req.user.id, transactions);
    // TODO: Implement with existing services or create excelService
    const result = { message: 'Excel service not implemented' };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Excel processing error:', error);
    
    if (error.message.includes('limit exceeded') || error.message.includes('Trial expired')) {
      return res.status(429).json({
        error: error.message,
        upgradeRequired: true
      });
    }
    
    res.status(500).json({
      error: 'Failed to process transactions',
      message: error.message
    });
  }
});

router.post('/generate-formulas', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Formula description is required' });
    }

    // const result = await excelService.generateExcelFormulas(req.user.id, description);
    // TODO: Implement with existing services or create excelService
    const result = { message: 'Excel formula service not implemented' };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Formula generation error:', error);
    
    if (error.message.includes('limit exceeded') || error.message.includes('Trial expired')) {
      return res.status(429).json({
        error: error.message,
        upgradeRequired: true
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate formulas',
      message: error.message
    });
  }
});

router.get('/usage-stats', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // const stats = await excelService.getUserUsageStats(req.user.id);
    // TODO: Implement with existing services or create excelService
    const stats = { message: 'Usage stats service not implemented' };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Usage stats error:', error);
    
    res.status(500).json({
      error: 'Failed to get usage stats',
      message: error.message
    });
  }
});

router.post('/generate-excel', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userInput } = req.body;
    
    if (!userInput) {
      return res.status(400).json({ error: 'User input is required' });
    }

    // const result = await excelService.processTransactions(req.user.id, userInput);
    // TODO: Implement with existing services or create excelService
    const result = { message: 'Excel generation service not implemented' };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Excel generation error:', error);
    
    if (error.message.includes('limit exceeded') || error.message.includes('Trial expired')) {
      return res.status(429).json({
        error: error.message,
        upgradeRequired: true
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate Excel',
      message: error.message
    });
  }
});

export default router;