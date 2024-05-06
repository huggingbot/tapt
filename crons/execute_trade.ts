/**
 * This function is responsible for executing the trade which met the trading criteria
 * In trading crons workflow, we can list this trade as cron number 3
 * For e.g:
 *    limit order: [submit_approval] -> [track_txn] -> [check_orders_criteria] -> **[execute_trade]** -> [track_txn] -> (DONE)
 */
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';

import { ENetwork } from '../src/libs/config';
import { getProvider, TransactionState } from '../src/libs/providers';
import { executeRoute, generateRoute } from '../src/libs/routing';
import { ETransactionType } from '../src/types';
import { decryptPrivateKey } from '../src/utils/crypto';
import { EOrderStatus, TAPT_API_ENDPOINT } from './utils/constants';
import { ApiResponse, ILimitOrder } from './utils/types';

export async function executeTrade() {
  const resp = await fetch(`${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ExecutionReady}`);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;

  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;

  for (let i = 0; i < orders.length; i++) {
    // execute order
    const provider = getProvider(ENetwork.Local);
    const { id: orderId, sellAmount, sellToken, buyToken, wallet: walletDetails } = orders[i];

    const tokenIn = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenOut = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);
    const privateKey = decryptPrivateKey(walletDetails.encryted_private_key);
    const wallet = new ethers.Wallet(privateKey, provider);

    const route = await generateRoute(wallet, ENetwork.Local, { tokenIn, tokenOut, amount: Number(sellAmount) });

    const body: { orderStatus: string; buyAmount?: number; transaction?: { hash: string; type: string; toAddress: string } } = {
      orderStatus: EOrderStatus.ExecutionPending,
    };
    if (route) {
      const res = await executeRoute(wallet, ENetwork.Local, route);
      if (res === TransactionState.Failed) {
        // failed update db
        body.orderStatus = EOrderStatus.Failed;
      } else {
        const txnRes = res as ethers.providers.TransactionResponse;
        // update db
        body.buyAmount = Number(route.quote.toExact());
        if (txnRes.to) {
          body.transaction = {
            hash: txnRes.hash,
            type: ETransactionType.Withdraw,
            toAddress: txnRes.to,
          };
        }
      }
    }

    await fetch(`${TAPT_API_ENDPOINT}/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }
}
