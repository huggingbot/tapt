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
  const url = `${TAPT_API_ENDPOINT}/transactions?type=${ETransactionType.Swap}&status=${ETransactionStatus.Pending}`;
  console.log('url', url);
  const resp = await fetch(url);
  const jsonResp = (await resp.json()) as ApiResponse<ITransaction[]>;
  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const txns = jsonResp.data;
  console.log('txns', txns);
  const txnsToUpdate: (Pick<ITransaction, 'transactionFee' | 'transactionStatus' | 'orderId' | 'transactionType'> & { transactionId: number })[] = [];

  for (let i = 0; i < txns.length; i++) {
    // track txn
    const { transactionHash, orderId, transactionType, id: transactionId } = txns[i];
    const provider = getProvider(ENetwork.Local);
    const txnReceipt = await provider.getTransactionReceipt(transactionHash);
    console.log('txn_receipt', txnReceipt);
    if (txnReceipt != null) {
      const transactionFee = txnReceipt.gasUsed.toNumber();
      const transactionStatus = ETransactionStatus.Confirmed;
      txnsToUpdate.push({ orderId, transactionType, transactionStatus, transactionFee, transactionId });
    }
  }

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
