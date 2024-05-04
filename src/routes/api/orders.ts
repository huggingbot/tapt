import { celebrate, Joi, Segments } from 'celebrate';
import { RequestHandler, Router } from 'express';

import { bulkUpdateOrderStatus, getAllActiveLimitOrdersHandler } from '@/controllers/orders';

const router = Router();

router.get('/limit', getAllActiveLimitOrdersHandler as RequestHandler);

router.patch(
  '/bulk_update_status',
  celebrate({
    [Segments.BODY]: Joi.object({
      setdata: Joi.object({
        orderStatus: Joi.string().required(),
      }).required(),
      idsToUpdate: Joi.array().items(Joi.number()).required(),
    }),
  }),
  bulkUpdateOrderStatus as RequestHandler,
);

export default router;
