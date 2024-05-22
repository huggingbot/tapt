import { Request, Response } from 'express';
import { Transaction } from 'kysely';
import log from 'loglevel';

import { db } from '@/database/db';
import { DB } from '@/database/gen-types';
import { bulkUpdateByOrderIds, getOrderById, getOrders, GetOrdersFilters, updateOrderById, UpdateOrderParams } from '@/database/queries/order';
import { createTransaction } from '@/database/queries/transaction';
import { EOrderType, ETransactionStatus } from '@/types';
import { isNumber } from '@/utils/common';

export async function getAllActiveLimitOrdersHandler(req: Request, res: Response) {
  try {
    const { orderStatus } = req.query;
    const getOrderFilters: GetOrdersFilters = { orderType: EOrderType.Limit };
    log.debug('orderStatus', orderStatus);
    if (orderStatus) {
      getOrderFilters.orderStatus = orderStatus as string;
    }
    const data = await db.transaction().execute(async (trx) => {
      const orders = await getOrders(getOrderFilters, trx);
      return orders;
    });

    return res.status(200).json({ success: true, data });
  } catch (e: unknown) {
    console.error('error getting active limit orders', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}

export async function bulkUpdateOrderStatus(req: Request, res: Response) {
  try {
    const { setdata, idsToUpdate } = req.body as { setdata?: UpdateOrderParams; idsToUpdate?: number[] };
    if (!setdata || !idsToUpdate) {
      return res.status(400).json({ success: false, error: 'invalid request' });
    }

    await bulkUpdateByOrderIds(setdata, idsToUpdate);
    return res.status(201).json({ success: true, message: `Updated the orders with ids, ${idsToUpdate.join(',')}.` });
  } catch (e: unknown) {
    console.error('error bulk_update_order status', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}

export async function updateOrderByIdHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    if (!isNumber(orderId)) {
      return res.status(400).json({ success: false, error: `invalid order_id, ${orderId}` });
    }

    let transactionId = -1;
    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const order = await getOrderById(Number(orderId), trx);
      if (!order) {
        throw new Error(`no order found with id, ${orderId}`);
      }
      const { orderStatus, transaction } = req.body as { orderStatus: string; transaction?: { hash: string; toAddress: string; type: string } };
      await updateOrderById(Number(orderId), { orderStatus }, trx);
      // update transaction table
      if (transaction) {
        const txn = await createTransaction(
          {
            orderId: order.id,
            walletId: order.walletId,
            transactionHash: transaction.hash,
            toAddress: transaction.toAddress,
            transactionType: transaction.type,
            transactionStatus: ETransactionStatus.Pending,
          },
          trx,
        );
        if (!txn) {
          throw new Error('error creating new transaction');
        }
        transactionId = txn.id;
      }
    });
    return res.status(201).json({ success: true, data: { orderId, transactionId } });
  } catch (e: unknown) {
    console.error('error updating orders', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}
