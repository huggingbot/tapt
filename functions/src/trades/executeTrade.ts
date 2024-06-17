/* eslint-disable max-len */
import { Token } from '@uniswap/sdk-core';
import { logger } from 'firebase-functions';
import { SwapRoute } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';
import { TAPT_API_ENDPOINT, WRAPPED_NATIVE_TOKEN } from '../utils/constants';
import { fromChainIdToNetwork, getProvider } from '../utils/providers';
import { EOrderStatus, ILimitOrder, ENetwork, IUpdateOrderRequestBody, TransactionState, ETransactionType, TradeMode, IToken } from '../utils/types';
import { decrypt } from '../utils/crypto';
import { generateRoute, executeRoute } from '../utils/routing';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';
import { countdown, unwrapNativeToken, wrapNativeToken } from '../utils/helpers';

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
export async function executeLimitTrades() {
  const start = Date.now();
  const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ExecutionReady}`;
  const orders = await makeNetworkRequest<ILimitOrder[]>(fetchReadyToExecuteOrderUrl);
  logger.debug('orders to be executed', orders);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    wallet: ethers.Wallet;
    network: ENetwork;
    route?: SwapRoute;
    orderMode: TradeMode;
    sellToken: IToken;
    buyToken: IToken;
    sellAmount: string;
  }[] = [];

  const wrapNativeTokenPromises = orders.map((order) => {
    const { orderId, sellAmount, sellToken, buyToken, encryptedPrivateKey, chainId, orderMode } = order;

    const network = fromChainIdToNetwork(chainId);
    const provider = getProvider(network);
    const privateKey = decrypt(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    additionalParams.push({ orderId, wallet, network, sellToken, buyToken, sellAmount, orderMode: orderMode || 'buy' });

    if (orderMode === 'buy') {
      return wrapNativeToken(wallet, network, Number(sellAmount));
    } else {
      return undefined;
    }
  });
  const wrapNativeTokenResult = await Promise.allSettled(wrapNativeTokenPromises);

  // generating routes
  const routeGenPromises = wrapNativeTokenResult.map((result, idx) => {
    const { sellAmount, sellToken, buyToken, orderMode, network, wallet } = additionalParams[idx];

    const tokenOut = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenIn = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    if (orderMode === 'buy') {
      return generateRoute(wallet, network, { tokenIn: WRAPPED_NATIVE_TOKEN[network], tokenOut, amount: Number(sellAmount) });
    } else {
      return generateRoute(wallet, network, { tokenIn, tokenOut: WRAPPED_NATIVE_TOKEN[network], amount: Number(sellAmount) });
    }
  });
  const routeGenResult = await Promise.allSettled(routeGenPromises);

  // executing routes
  const routeExecPromises = routeGenResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    additionalParams[idx] = { ...additionalParams[idx], route: result.value };
    const { wallet, network } = additionalParams[idx];
    return executeRoute(wallet, network, result.value);
  });
  const routeExecResult = await Promise.allSettled(routeExecPromises);

  // unwrapping to native token after the 'sell' trade,
  const unwrapNativeTokenPromises = routeExecResult.map((result, idx) => {
    const { orderMode, wallet, network, route } = additionalParams[idx];

    if (result.status === 'rejected' || !result.value || !route) {
      return undefined;
    }

    if (orderMode === 'sell') {
      return unwrapNativeToken(wallet, network, Number(route.quote.toExact()));
    }
    return undefined;
  });
  await Promise.allSettled(unwrapNativeTokenPromises);

  // update database based on `routeExecResult`
  const updateOrderResult = await Promise.allSettled(
    routeExecResult.map((result, idx) => {
      const { route, orderId } = additionalParams[idx];
      if (result.status === 'rejected' || !result.value || !route) {
        return undefined;
      }
      const res = result.value;
      logger.debug('Txn Result', res);
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
      return makeNetworkRequest(`${TAPT_API_ENDPOINT}/orders/${orderId}`, 'PATCH', body as unknown as Record<string, unknown>);
    }),
  );
  logger.info(`Execution of limit trades take ${Date.now() - start} ms to finish`);
  return updateOrderResult;
}

export const tradeExecution = createScheduleFunction(async () => {
  try {
    await countdown(
      3,
      async () => {
        const result = await executeLimitTrades();
        logger.info('trade executed', result);
      },
      3_000,
    );
  } catch (e: unknown) {
    handleError(e);
  }
});
