import { EOrderType, IDcaOrder, ILimitOrder } from '@/types';

export function composeOrderNotificationText(order: Partial<ILimitOrder | IDcaOrder>, txn?: string) {
  const { orderId, orderStatus, orderType, buyToken, sellAmount, sellToken, orderMode } = order;
  let message = `There's an update for your order.\n
Order ID:\t${orderId}
Order Type:\t${orderType}
Order Mode:\t${orderMode || 'buy'}
Order Status:\t${orderStatus}
  `;

  if (orderType === EOrderType.Limit) {
    const { targetPrice } = order as ILimitOrder;
    message = `${message}
Target Price: ${targetPrice} ETH
    `;
  } else {
    const { duration, interval } = order as IDcaOrder;
    message = `${message}
Duration:\t${duration} mins
Frequency:\t${interval} mins
    `;
  }

  if (orderMode === 'buy') {
    message = `${message}\n
Buy\n=====
Token:\t${buyToken?.symbol}(${buyToken?.contractAddress})
Amount:\t${sellAmount} ETH\n
    `;
  } else {
    message = `${message}\n
Sell\n=====
Token:\t${sellToken?.symbol}(${sellToken?.contractAddress})
Amount:\t${sellAmount} ETH\n
    `;
  }

  // if (orderStatus === EOrderStatus.ExecutionPending) {
  //   message = `${message}\nBuy Amount: ${ethers.pa} ETH`
  // }

  if (txn) {
    message = `${message}\n
Transaction Hash: ${txn}
    `;
  }
  return message;
}
