import express from 'express';

import defaultRoute from './default';

const router = express.Router();

router.use('/', defaultRoute);

export default router;
