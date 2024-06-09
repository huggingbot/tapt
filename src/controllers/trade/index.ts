import { Request, Response } from 'express';
import log from 'loglevel';

import { db } from '@/database/db';
import { getOrders, GetOrdersFilters } from '@/database/queries/order';

export async function getAllOrders(req: Request, res: Response) {
  try {
    const { orderType, orderStatus } = req.query;

    const getOrderFilters: GetOrdersFilters = {};

    if (orderType) {
      getOrderFilters.orderType = orderType as string;
    }
    if (orderStatus) {
      getOrderFilters.orderStatus = orderStatus as string;
    }

    const data = await db.transaction().execute(async (trx) => {
      const orders = await getOrders(getOrderFilters, trx);
      return orders;
    });

    return res.status(200).json({ success: true, data });
  } catch (e: unknown) {
    log.error('error getting active orders', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}
