/* eslint-disable max-len */
import { logger } from 'firebase-functions';
import { TAPT_API_ENDPOINT } from '../utils/constants';
import { EOrderStatus, ILimitOrder } from '../utils/types';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';

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
  try {
    const start = Date.now();
    const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ExecutionReady}`;
    const orders = await makeNetworkRequest<ILimitOrder[]>(fetchReadyToExecuteOrderUrl);

    const resp = await Promise.allSettled(
      orders.map((order) => {
        const executeTradeUrl = `${TAPT_API_ENDPOINT}/trades/execute/${order.orderId}`;
        return makeNetworkRequest(executeTradeUrl, 'POST');
      }),
    );
    logger.info(`Execution of limit trades take ${Date.now() - start} ms to finish`);
    return resp;
  } catch (e: unknown) {
    logger.error(`Error exeucting trade: ${(e as Error).message}`);
    return undefined;
  }
}

export const tradeExecution = createScheduleFunction(async () => {
  try {
    let start = Date.now();
    const functionID = Date.now();
    const result = await executeLimitTrades();
    logger.info(`[${functionID}] trade executed: ${JSON.stringify(result)}`);
    let timeConsumedInMs = Date.now() - start;
    logger.debug(`[${functionID}] Trade execution takes ${timeConsumedInMs} ms to complete!`);
  } catch (e: unknown) {
    handleError(e);
  }
});
