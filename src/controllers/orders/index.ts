import { Request, Response } from 'express';
import { Transaction } from 'kysely';

import { db } from '@/database/db';
import { DB } from '@/database/gen-types';
import {
  bulkUpdateByOrderIds,
  getOrderById,
  getOrders,
  GetOrdersFilters,
  IOrder,
  updateOrderById,
  UpdateOrderParams,
} from '@/database/queries/order';
import { getTokenDetailsById, TokenDetails } from '@/database/queries/token';
import { createTransaction } from '@/database/queries/transaction';
import { ETransactionStatus } from '@/types';
import { isNumber } from '@/utils/common';

export async function getAllActiveLimitOrdersHandler(req: Request, res: Response) {
  try {
    const { orderStatus } = req.query;
    const getOrderFilters: GetOrdersFilters = { orderType: 'LIMIT' };
    console.log('orderStatus', orderStatus);
    if (orderStatus) {
      getOrderFilters.orderStatus = orderStatus as string;
    }
    const data = await db.transaction().execute(async (trx) => {
      const orders = await getOrders(getOrderFilters, trx);
      // iterate orders and fetch token details
      // const orderWithDetails = await Promise.all(
      //   orders.map(async (order: IOrder) => {
      //     const buyToken = await getTokenDetailsById(order.buyTokenId, trx);
      //     const sellToken = await getTokenDetailsById(order.sellTokenId, trx);

      //     const orderDetails: IOrder & { buyToken: TokenDetails; sellToken: TokenDetails; chainId: number } = {
      //       ...order,
      //       buyToken,
      //       sellToken,
      //       chainId: buyToken.chainId,
      //     };
      //     return orderDetails;
      //   }),
      // );
      // // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      // return orderWithDetails;
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
    console.error('error getting active limit orders', e);
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
        return res.status(400).json({ success: false, error: `no order found with id, ${orderId}` });
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
        transactionId = txn?.id || -1;
      }
    });
    return res.status(201).json({ success: true, data: { orderId, transactionId } });
  } catch (e: unknown) {
    console.error('error getting active limit orders', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}
