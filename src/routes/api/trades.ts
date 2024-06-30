import { RequestHandler, Router } from 'express';

import { executeLimitTrades } from '@/controllers/trade/execute';
import { checkLimitOrderCriteria } from '@/controllers/trade/limit';

const router = Router();

// Since firebase functions are too slow to execute the `checkLimitOrderCriteria` and `orderExecution` operations
// we gonna do the these operations in the server side (TAPT API)
// we will keep this until we find a good solution for the firebase function performance issues
router.post('/check-limit-criteria', checkLimitOrderCriteria as RequestHandler);
router.post('/execute/:orderId', executeLimitTrades as RequestHandler);

export default router;
