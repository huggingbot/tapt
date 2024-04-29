import { Router } from 'express';

import orderRoutes from './orders';

const router = Router();

router.use('/orders', orderRoutes);

export default router;
