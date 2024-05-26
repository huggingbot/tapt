/* eslint-disable max-len */
import { logger } from 'firebase-functions';
import { TAPT_API_ENDPOINT } from '../utils/constants';
import { getProvider } from '../utils/providers';
import { ENetwork, ETransactionStatus, ITransaction } from '../utils/types';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';

interface IAdditionalTxnTrackerParams {
  orderId: number;
  transactionType: string;
  transactionId: number;
}

type TUpdateTransactionParams = Pick<ITransaction, 'transactionFee' | 'transactionStatus' | 'orderId' | 'transactionType'> & {
  transactionId: number;
};

/**
 * This function is responsible for tracking the pending transactions
 * and update the backend and db accordingly
 * This function will be used to run in between crons
 * For e.g:
 *    limit order: (from up to bottom)
 *    [submit_approval]
 *    **[track_txn]**
 *    [check_orders_criteria]
 *    [execute_trade]
 *    **[track_txn]**
 *    (DONE)
 */
async function trackTransaction() {
  // eslint-disable-next-line max-len
  const url = `${TAPT_API_ENDPOINT}/transactions?status=${ETransactionStatus.Pending}`;
  const txns = await makeNetworkRequest<ITransaction[]>(url);

  const txnsToUpdate: TUpdateTransactionParams[] = [];
  // additional params which will be used during difference promises iteration
  const additionalParams: IAdditionalTxnTrackerParams[] = [];

  const txnReceiptPromises = txns.map((txn) => {
    const { transactionHash, orderId, transactionType, id: transactionId } = txn;
    const provider = getProvider(ENetwork.Local);
    additionalParams.push({ orderId, transactionId, transactionType });
    return provider.getTransactionReceipt(transactionHash);
  });
  const txnReceiptResults = await Promise.allSettled(txnReceiptPromises);

  txnReceiptResults.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      const { orderId, transactionType, transactionId } = additionalParams[idx];
      const txnReceipt = result.value;
      const transactionFee = txnReceipt.gasUsed.toNumber();
      const transactionStatus = ETransactionStatus.Confirmed;
      txnsToUpdate.push({ orderId, transactionType, transactionStatus, transactionFee, transactionId });
    }
  });

  if (txnsToUpdate.length > 0) {
    await makeNetworkRequest(`${TAPT_API_ENDPOINT}/transactions/bulk_update`, 'PATCH', { data: txnsToUpdate });
  }
  return txnsToUpdate;
}

// track transaction
export const txnTracker = createScheduleFunction(async () => {
  try {
    const updatedTxns = await trackTransaction();
    logger.info('[txnTracker] updated transactions', updatedTxns);
  } catch (e: unknown) {
    handleError(e);
  }
});
