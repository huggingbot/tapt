import { RequestHandler, Router } from 'express';

import { executeLimitTrades } from '@/controllers/trade/execute';
import { checkLimitOrderCriteria } from '@/controllers/trade/limit';

const router = Router();

router.post('/check-limit-criteria/:orderId', checkLimitOrderCriteria as RequestHandler);

router.post('/execute/:orderId', executeLimitTrades as RequestHandler);

export default router;
