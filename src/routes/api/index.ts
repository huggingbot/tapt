import { Router } from 'express';

import orderRoutes from './orders';
import transactionRoutes from './transactions';

const router = Router();

router.use('/orders', orderRoutes);
router.use('/transactions', transactionRoutes);

export default router;
