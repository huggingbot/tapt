import { celebrate, Joi, Segments } from 'celebrate';
import { RequestHandler, Router } from 'express';

import { bulkUpdateOrderStatus, getAllActiveLimitOrdersHandler, updateOrderByIdHandler } from '@/controllers/orders';

const router = Router();

router.get('/limit', getAllActiveLimitOrdersHandler as RequestHandler);

router.patch(
  '/:orderId',
  celebrate(
    {
      [Segments.BODY]: Joi.object({
        orderStatus: Joi.string().required(),
        transaction: Joi.object({
          hash: Joi.string().required(),
          toAddress: Joi.string().required(),
          type: Joi.string().required(),
        }),
        buyAmount: Joi.number(),
      }).required(),
    },
    { allowUnknown: true },
  ),
  updateOrderByIdHandler as RequestHandler,
);

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
