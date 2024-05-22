/* eslint-disable max-len */
import { Token } from '@uniswap/sdk-core';
import { SwapRoute } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';
import { TAPT_API_ENDPOINT } from '../utils/constants';
import { getProvider } from '../utils/providers';
import { EOrderStatus, ApiResponse, ILimitOrder, ENetwork, IUpdateOrderRequestBody, TransactionState, ETransactionType } from '../utils/types';
import { decrypt } from '../utils/crypto';
import { generateRoute, executeRoute } from '../utils/routing';
import { onRequest } from 'firebase-functions/v2/https';
import { handleErrorResponse } from '../utils/responseHandler';

/**
 * This function is responsible for executing the trade which met the trading criteria
 * In trading crons workflow, we can list this trade as cron number 3
 * For e.g:
 *    limit order: (from up to bottom)
 *    [submit_approval]
 *    [track_txn]
 *    [check_orders_criteria]
 *    **[execute_trade]
 *    [track_txn]
 *    (DONE)
 * */
async function executeTrade() {
  const resp = await fetch(`${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ExecutionReady}`);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;

  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;

  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    wallet: ethers.Wallet;
    route?: SwapRoute;
  }[] = [];

  // generating routes
  const routeGenPromises = orders.map((order) => {
    const provider = getProvider(ENetwork.Local);
    const { orderId, sellAmount, sellToken, buyToken, encryptedPrivateKey } = order;

    const tokenIn = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenOut = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);
    const privateKey = decrypt(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    // save to additional param for later use
    additionalParams.push({ orderId, wallet });
    return generateRoute(wallet, ENetwork.Local, { tokenIn, tokenOut, amount: Number(sellAmount) });
  });
  const routeGenResult = await Promise.allSettled(routeGenPromises);

  // executing routes
  const routeExecPromises = routeGenResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    additionalParams[idx] = { ...additionalParams[idx], route: result.value };
    const { wallet } = additionalParams[idx];
    return executeRoute(wallet, ENetwork.Local, result.value);
  });
  const routeExecResult = await Promise.allSettled(routeExecPromises);

  // update database based on `routeExecResult`
  return await Promise.allSettled(
    routeExecResult.map((result, idx) => {
      const { route, orderId } = additionalParams[idx];
      if (result.status === 'rejected' || !result.value || !route) {
        return undefined;
      }
      const res = result.value;
      const body: IUpdateOrderRequestBody = {
        orderStatus: EOrderStatus.ExecutionPending,
      };
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
      // TODO: replace with BULK_UPDATE instead of multiple updates
      return fetch(`${TAPT_API_ENDPOINT}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }),
  );
}

export const tradeExecution = onRequest(async (req, res) => {
  try {
    const result = await executeTrade();
    res.json({ result });
  } catch (e: unknown) {
    handleErrorResponse(res, e);
  }
});
