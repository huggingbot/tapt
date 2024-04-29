import express from 'express';

import apiRoutes from './api';
import defaultRoute from './default';

const router = express.Router();

router.use('/', defaultRoute);
router.use('/api', apiRoutes);

export default router;
