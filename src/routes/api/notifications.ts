import { RequestHandler, Router } from 'express';

import { sendNotificationHandler } from '@/controllers/notifications';

const router = Router();

router.post('/', sendNotificationHandler as RequestHandler);

export default router;
