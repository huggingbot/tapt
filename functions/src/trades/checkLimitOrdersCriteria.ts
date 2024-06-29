/* eslint-disable max-len */

import { EOrderStatus, ILimitOrder, TradeMode } from '../utils/types';
import { TAPT_API_ENDPOINT } from '../utils/constants';
import { logger } from 'firebase-functions';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';

/**
 * Check if the trade criteria met with the current price and target price
 * @param {TradeMode} orderMode - 'buy' | 'sell'
 * @param {number} amountIn - current market price of the token
 * @param {number} targetPrice - targetted price to exectue the trade if met
 * @return {boolean} True if limit order criteria met, otherwise false
 */
export function isLimitOrderCriteriaMet(orderMode: TradeMode, amountIn: number, targetPrice: number): boolean {
  return (orderMode === 'buy' && amountIn <= targetPrice) || (orderMode === 'sell' && amountIn >= targetPrice);
}

/**
 * This function is responsible for checking
 * the trading criteria in current market based on the order placed
 * If the trading criteria has met, then it will update the backend and db,
 * so that the next function in line can execute the orders
 * In trading crons workflow, we can list this trade as cron number 2
 * For e.g:
 *    limit order: (from up to bottom)
 *    [submit_approval]
 *    [track_txn]
 *    **[check_orders_criteria]
 *    [execute_trade]
 *    [track_txn]
 *    (DONE)
 */
export async function checkLimitOrderCriteria() {
  const start = Date.now();
  const fetchApprovalCompletedOrdersUrl = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ApprovalCompleted}`;
  const orders = await makeNetworkRequest<ILimitOrder[]>(fetchApprovalCompletedOrdersUrl);

  const resp = await Promise.allSettled(
    orders.map((order) => {
      console.log('approved order', order);
      const executeTradeUrl = `${TAPT_API_ENDPOINT}/trades/check-limit-criteria/${order.orderId}`;
      return makeNetworkRequest(executeTradeUrl, 'POST');
    }),
  );

  logger.info(`Checking limit criteria take ${Date.now() - start} ms to finish`);
  return resp;
  // const ordersToBePrcessed: Partial<ILimitOrder>[] = [];
  // // additional params which will be shared between promises iterations
  // const additionalParams: {
  //   order: ILimitOrder;
  //   tokenInput: Token;
  //   tokenOutput: Token;
  //   network: ENetwork;
  // }[] = [];
  // compute TokenPool Addr and get Tokens Details
  // const tokensDetailsPromise = orders.map((order) => {
  //   const { buyToken, sellToken, chainId, } = order;

  //   const network = fromChainIdToNetwork(chainId);
  //   const provider = getProvider(network);
  //   const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
  //   const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

  //   const currentPoolAddress = computePoolAddress({
  //     factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
  //     tokenA: tokenOutput,
  //     tokenB: tokenInput,
  //     fee: FeeAmount.MEDIUM,
  //   });

  //   additionalParams.push({ order, tokenInput, tokenOutput, network });

  //   const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
  //   return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
  // });
  // const tokenDetailsResult = await Promise.allSettled(tokensDetailsPromise);
  // logger.debug("tokenDetailsResult", tokenDetailsResult);

  // // Quote current market price for Target Token
  // const quotedAmountsPromises = tokenDetailsResult.map((result, idx) => {
  //   if (result.status === 'rejected' || !result.value) {
  //     return undefined;
  //   }

  //   const { tokenInput, tokenOutput, order, network } = additionalParams[idx];
  //   const provider = getProvider(network);
  //   const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);

  //   const decimals = order.orderMode === 'buy' ? tokenOutput.decimals : tokenInput.decimals;
  //   const [token0, token1, fee] = result.value;
  //   const amountIn = ethers.utils.parseUnits('1', decimals);
  //   return quoterContract.callStatic.quoteExactInputSingle(token0, token1, fee, amountIn, 0);
  // });
  // const quotedAmountResults = await Promise.allSettled(quotedAmountsPromises);
  // logger.debug("quotedAmountResults", quotedAmountResults);

  // // Validate and check LIMIT_ORDER crtieria
  // quotedAmountResults.forEach((result, idx) => {
  //   const { tokenOutput, tokenInput, order } = additionalParams[idx];
  //   const { orderId, targetPrice, orderMode } = order;
  //   const baseSymbol = orderMode === 'buy' ? tokenInput.symbol : tokenOutput.symbol;
  //   const targetSymbol = orderMode === 'buy' ? tokenOutput.symbol : tokenInput.symbol;
  //   const decimals = orderMode === 'buy' ? tokenInput.decimals : tokenOutput.decimals;
  //   if (result.status === 'fulfilled' && result.value) {
  //     const amountOut = ethers.utils.formatUnits(result.value, decimals);
  //     logger.debug('=====================');
  //     logger.debug(`Target Price: ${targetPrice}`);
  //     logger.debug(`1 ${baseSymbol} can be swapped for ${amountOut} ${targetSymbol}`);
  //     logger.debug('=====================');

  //     if (isLimitOrderCriteriaMet(orderMode || 'buy', Number(amountOut), targetPrice)) {
  //       // send for approval
  //       logger.debug(`Limit order condition met for order with id, ${orderId}`);
  //       ordersToBePrcessed.push(order);
  //     }
  //   }
  // });
  // logger.info(`Checking Limit Orders Criteria takes ${Date.now() - start} ms to complete!`);

  // if (ordersToBePrcessed.length > 0) {
  //   // bulk update orders
  //   const body = {
  //     setdata: { orderStatus: EOrderStatus.ExecutionReady },
  //     idsToUpdate: ordersToBePrcessed.map((o) => o.orderId),
  //   };
  //   const resp = await makeNetworkRequest(`${TAPT_API_ENDPOINT}/orders/bulk_update_status`, 'PATCH', body);
  //   console.log(resp);
  // }

  // // send notifications
  // Promise.allSettle(
  //   ordersToBePrcessed.map((order) => {
  //     const message = composeOrderNotificationText({
  //       ...order,
  //       orderStatus: EOrderStatus.ExecutionReady,
  //     });
  //     return makeNetworkRequest(`${TAPT_API_ENDPOINT}/notifications`, 'POST', {
  //       userId: order.userId,
  //       message,
  //     });
  //   }),
  // );

  // return undefined;
}

export const limitOrderCriteriaChecker = createScheduleFunction(async () => {
  try {
    const result = await checkLimitOrderCriteria();
    if (!result) {
      logger.info('[limitOrderCriteriaChecker] none of the `limit` orders met the criteria');
    } else {
      logger.info('[limitOrderCriteriaChecker] trade criteria met:', result);
    }
  } catch (e: unknown) {
    handleError(e);
  }
});
