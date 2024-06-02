import { celebrate, Joi, Segments } from 'celebrate';
import { RequestHandler, Router } from 'express';

import { bulkUpdateTransactionsHandler, getTransactionsHandler } from '@/controllers/transactions';

const router = Router();

router.get('/', getTransactionsHandler as RequestHandler);

router.patch(
  '/bulk_update',
  celebrate({
    [Segments.BODY]: Joi.object({
      data: Joi.array()
        .items(
          Joi.object({
            transactionId: Joi.number().required(),
            transactionStatus: Joi.string().required(),
            transactionType: Joi.string().required(),
            transactionFee: Joi.number(),
            orderId: Joi.number(),
          }),
        )
        .required(),
    }),
  }),
  bulkUpdateTransactionsHandler as RequestHandler,
);

export default router;
