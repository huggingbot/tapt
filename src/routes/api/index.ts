import { Router } from 'express';

import notificationRoutes from './notifications';
import orderRoutes from './orders';
import transactionRoutes from './transactions';

const router = Router();

router.use('/orders', orderRoutes);
router.use('/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);

export default router;
