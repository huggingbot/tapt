import { Request, RequestHandler, Response, Router } from 'express';

import { getOrders } from '@/database/queries/order';

const router = Router();

async function getAllActiveLimitOrdersHandler(_req: Request, res: Response) {
  try {
    const data = await getOrders({ orderType: 'LIMIT' });
    return res.status(200).json({ success: true, data });
  } catch (e: unknown) {
    console.error('error getting active limit orders', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}

router.get('/limit/active', getAllActiveLimitOrdersHandler as RequestHandler);

export default router;
