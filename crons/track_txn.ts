/**
 * This function is responsible for tracking the pending transactions and update the backend and db accordingly
 * This function will be used to run in between crons
 * For e.g:
 *    limit order: [submit_approval] -> **[track_txn]** -> [check_orders_criteria] -> [execute_trade] -> **[track_txn]** -> (DONE)
 */
import { ENetwork } from '../src/libs/config';
import { getProvider } from '../src/libs/providers';
import { ETransactionStatus, ETransactionType } from '../src/types';
import { TAPT_API_ENDPOINT } from './utils/constants';
import { ApiResponse, ITransaction } from './utils/types';

export async function trackTransactions() {
  const url = `${TAPT_API_ENDPOINT}/transactions?type=${ETransactionType.Approval}&status=${ETransactionStatus.Pending}`;
  const resp = await fetch(url);
  const jsonResp = (await resp.json()) as ApiResponse<ITransaction[]>;
  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const txns = jsonResp.data;
  const txnsToUpdate: (Pick<ITransaction, 'transactionFee' | 'transactionStatus' | 'orderId' | 'transactionType'> & { transactionId: number })[] = [];
  // additional params which will be used during difference promises iteration
  const additionalParams: {
    orderId: number;
    transactionType: string;
    transactionId: number;
  }[] = [];

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
    await fetch(`${TAPT_API_ENDPOINT}/transactions/bulk_update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: txnsToUpdate }),
    });
  }
}

(async function () {
  await trackTransactions();
})();
