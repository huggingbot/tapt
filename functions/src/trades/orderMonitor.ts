import { TAPT_API_ENDPOINT } from '../utils/constants';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';
import { handleError } from '../utils/responseHandler';
import { EOrderStatus, IDcaOrder, ILimitOrder } from '../utils/types';
import { logger } from 'firebase-functions';

/**
 * This function is responsible for monitoring
 * the orders' fields and data.
 * for e.g.
 *   every minutes it scan through the order database and update the status of the order
 *   which are expired or no longer needed to be executed.
 */
export async function orderStatusChecker() {
  const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders?orderStatus=${EOrderStatus.Active}`;
  const orders = await makeNetworkRequest<(ILimitOrder | IDcaOrder)[]>(fetchReadyToExecuteOrderUrl);
  const expiredOrders = orders
    .filter((order) => {
      const { expirationDate } = order;
      if (expirationDate) {
        const expiryDate = new Date(expirationDate);
        const currentTS = new Date();
        return expiryDate.getTime() < currentTS.getTime();
      } else {
        return true;
      }
    })
    .map((order) => order.orderId);

  // update orders as expired
  if (expiredOrders.length > 0) {
    // bulk update orders
    const body = {
      setdata: { orderStatus: EOrderStatus.Expired },
      idsToUpdate: expiredOrders,
    };
    const resp = await makeNetworkRequest(`${TAPT_API_ENDPOINT}/orders/bulk_update_status`, 'PATCH', body);
    return resp;
  }
  return undefined;
}

export const orderMonitor = createScheduleFunction(async () => {
  try {
    const result = await orderStatusChecker();
    if (!result) {
      logger.info('[dcaOrderExecutor] none of the `DCA` orders met the criteria');
    } else {
      logger.info('[dcaOrderExecutor] trade criteria met:', result);
    }
  } catch (e: unknown) {
    handleError(e);
  }
});
