import { EOrderStatus, EOrderType, IDcaOrder, ILimitOrder } from '@/types';

export function composeOrderNotificationText(order: Partial<ILimitOrder>, txn?: string) {
  const { orderId, orderType, orderMode, orderStatus } = order;
  let message = `There's an update for your order.\n
Order ID:\t${orderId}
Order Type:\t${orderType}
Order Mode:\t${orderMode || 'buy'}
Order Status:\t${orderStatus}
  `;

  const { targetPrice } = order as ILimitOrder;
  message = `${message}\nTarget Price: ${targetPrice} ETH`;

  message = `${message}\n${generateTradeDetails(order, txn)}`;

  return message;
}

function generateTradeDetails(order: Partial<ILimitOrder | IDcaOrder>, hash?: string) {
  const { buyToken, sellToken, sellAmount, buyAmount } = order;

  let amountBought = `${buyAmount} ${buyToken?.symbol}`;
  if (order.orderType === EOrderType.Limit && order.orderStatus !== String(EOrderStatus.ExecutionPending)) {
    amountBought = 'TBD';
  }

  const tokenBought = `Token Bought: ${buyToken?.symbol}
Token Address: ${buyToken?.contractAddress}
Amount bought: ${amountBought}\n\t\t-----`;

  const tokenSold = `Token Sold: ${sellToken?.symbol}
Token Address: ${sellToken?.contractAddress}
Amount Sold: ${sellAmount} ${sellToken?.symbol}\n\t\t-----`;

  let message = `Trade Details\n============\n${tokenBought}\n${tokenSold}`;

  if (hash) {
    message = `${message}\n
Transaction Hash: ${hash}
  `;
  }

  return message;
}
