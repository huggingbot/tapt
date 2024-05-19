/**
 * Ideally, this function will be first function in the trading work flow.
 * This function is responsible for checking token allowance from wallet and getting approval to spend tokens
 * In trading crons workflow, we can list this trade as cron number 1
 * For e.g:
 *    limit order: **[submit_approval]** -> [track_txn] -> [check_orders_criteria] -> [execute_trade] -> [track_txn] -> (DONE)
 */
import { BigNumber, ethers } from 'ethers';

import { V3_UNISWAP_ROUTER_ADDRESS } from '@/libs/constants';

import ERC20_ABI from '../src/contracts/ERC_20_abi.json';
import { ENetwork } from '../src/libs/config';
import { getProvider, sendTransactionViaWallet, TransactionState } from '../src/libs/providers';
import { ETransactionType } from '../src/types/db';
import { decryptPrivateKey } from '../src/utils/crypto';
import { EOrderStatus, TAPT_API_ENDPOINT } from './utils/constants';
import { fromReadableAmount } from './utils/helpers';
import { ApiResponse, ILimitOrder } from './utils/types';

async function submitApproval() {
  const url = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.Submitted}`;
  const resp = await fetch(url);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;
  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;

  for (let i = 0; i < orders.length; i++) {
    const { id: orderId, sellAmount, sellToken, encryptedPrivateKey } = orders[i];

    const provider = getProvider(ENetwork.Local);
    // create wallet instance
    const privateKey = decryptPrivateKey(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    const tokenOutContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
    // check allowance allocated by wallet
    const allowance: BigNumber = await tokenOutContract.allowance(wallet.address, V3_UNISWAP_ROUTER_ADDRESS[ENetwork.Local]);
    const amountOut = ethers.utils.parseUnits(sellAmount, sellToken.decimalPlaces);

    const body: { orderStatus: string; transaction?: { hash: string; type: string; toAddress: string } } = {
      orderStatus: EOrderStatus.ApprovalPending,
    };
    if (allowance.lt(amountOut)) {
      // request approval
      const tokenApproval = await tokenOutContract.populateTransaction.approve(
        V3_UNISWAP_ROUTER_ADDRESS[ENetwork.Local],
        fromReadableAmount(Number(sellAmount), sellToken.decimalPlaces).toString(),
      );

      const approvalTxnResp = await sendTransactionViaWallet(wallet, ENetwork.Local, tokenApproval);
      if (approvalTxnResp === TransactionState.Failed) {
        console.error('failed to get approval');
        // update orders table as failed
        body.orderStatus = EOrderStatus.Failed;
      } else {
        const txn = approvalTxnResp as ethers.providers.TransactionResponse;
        if (txn.to) {
          body.transaction = {
            hash: txn.hash,
            type: ETransactionType.Approval,
            toAddress: txn.to,
          };
        }
      }
    }

    // no need to retry or check the resp, next iteration will be take care of it if it's failed
    await fetch(`${TAPT_API_ENDPOINT}/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }
}

(async function () {
  await submitApproval();
})();
