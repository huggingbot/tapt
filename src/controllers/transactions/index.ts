import { Request, Response } from 'express';

import { db } from '@/database/db';
import { updateOrderById } from '@/database/queries/order';
import { getTransactions, updateTransactionById, UpdateTransactionParams } from '@/database/queries/transaction';
import { EOrderStatus, ETransactionStatus, ETransactionType } from '@/types';

export async function getTransactionsHandler(req: Request, res: Response) {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const transactions = await getTransactions({ transactionStatus: status, transactionType: type });
    return res.status(200).json({ success: true, data: transactions });
  } catch (e: unknown) {
    console.error('error getting transations', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}

export async function bulkUpdateTransactionsHandler(req: Request, res: Response) {
  try {
    const { data } = req.body as { data: (UpdateTransactionParams & { transactionId: number })[] };
    await db.transaction().execute(async (trx) => {
      await Promise.all(
        data.map(async ({ transactionId, ...updatedata }) => {
          if (updatedata.transactionStatus === String(ETransactionStatus.Confirmed) && updatedata.orderId) {
            // update order
            const orderStatus =
              updatedata.transactionType === String(ETransactionType.Approval) ? EOrderStatus.ApprovalCompleted : EOrderStatus.Completed;
            await updateOrderById(updatedata.orderId, { orderStatus }, trx);
          }
          return updateTransactionById(updatedata, transactionId, trx);
        }),
      );
    });
    return res.status(201).json({ success: true, data: `${data.length} transactions updated successfully` });
  } catch (e: unknown) {
    console.error('error update bulk_update_transactions', e);
    const errMsg = (e as Error)?.message || 'unknown error';
    return res.status(500).json({ success: false, error: errMsg });
  }
}
