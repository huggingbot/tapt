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
      const executeTradeUrl = `${TAPT_API_ENDPOINT}/trades/check-limit-criteria/${order.orderId}`;
      return makeNetworkRequest(executeTradeUrl, 'POST');
    }),
  );

  logger.info(`Checking limit criteria take ${Date.now() - start} ms to finish`);
  return resp;
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
