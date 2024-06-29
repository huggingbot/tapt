import { Router } from 'express';

import notificationRoutes from './notifications';
import orderRoutes from './orders';
import tradeRoutes from './trades';
import transactionRoutes from './transactions';

const router = Router();

router.use('/orders', orderRoutes);
router.use('/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/trades', tradeRoutes);

export default router;
