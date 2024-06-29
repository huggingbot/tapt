import { Wallet } from 'ethers';
import JSBI from 'jsbi';
import { WRAPPED_NATIVE_TOKEN, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS } from './constants';
import { getWrappedNativeTokenContract } from './constracts';
import { getProvider } from './providers';
import { ENetwork, EOrderType, IDcaOrder, ILimitOrder } from './types';
import { sendTransactionViaWallet } from './transactions';
import { logger } from 'firebase-functions';

/**
 * convert number to JSBI value
 * @param {number} amount
 * @param {number} decimals
 * @return {JSBI} converted JSBI value
 */
export function fromReadableAmount(amount: number, decimals: number): JSBI {
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;
  return JSBI.divide(JSBI.multiply(JSBI.BigInt(adjustedAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))), JSBI.BigInt(extraDigits));
}

/**
 * Convert raw amount to read value
 * @param {number | string} rawAmount
 * @param {number} decimals
 * @return {string} readable string amount
 */
export function toReadableAmount(rawAmount: number | string, decimals: number): string {
  return JSBI.divide(JSBI.BigInt(rawAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))).toString();
}

/**
 * count decimal numbers
 * @param {number} x
 * @return {number}
 */
function countDecimals(x: number): number {
  if (Math.floor(x) === x) {
    return 0;
  }
  return x.toString().split('.')[1].length || 0;
}

// wraps native token (rounding up to the nearest native token for decimal places)
export async function wrapNativeToken(wallet: Wallet, network: ENetwork, amount: number) {
  const provider = getProvider(network);
  const wrappedNativeTokenContract = getWrappedNativeTokenContract(network, provider);

  const transaction = {
    data: wrappedNativeTokenContract.interface.encodeFunctionData('deposit'),
    value: fromReadableAmount(amount, WRAPPED_NATIVE_TOKEN[network].decimals).toString(),
    from: wallet.address,
    to: WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[network],
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
  };

  await sendTransactionViaWallet(wallet, network, transaction);
}

// unwraps native token (rounding up to the nearest native token for decimal places)
export async function unwrapNativeToken(wallet: Wallet, network: ENetwork, amount: number) {
  const provider = getProvider(network);
  const wrappedNativeTokenContract = getWrappedNativeTokenContract(network, provider);

  const transaction = {
    data: wrappedNativeTokenContract.interface.encodeFunctionData('withdraw', [
      fromReadableAmount(amount, WRAPPED_NATIVE_TOKEN[network].decimals).toString(),
    ]),
    from: wallet.address,
    to: WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[network],
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
  };

  await sendTransactionViaWallet(wallet, network, transaction);
}

export async function countdown(num: number, cb: () => Promise<any>, timeout?: number) {
  // Base case: if num is 0 or negative, stop recursion
  if (num - 1 <= 0) {
    const result = await cb();
    logger.info('result', num, result);
  } else {
    const result = await cb();
    logger.info('result', num, result);

    setTimeout(() => {
      countdown(num - 1, cb, timeout); // Recursive call
    }, timeout || 5_000);
  }
}

export function composeOrderNotificationText(order: Partial<ILimitOrder | IDcaOrder>, txn?: string) {
  const { orderId, orderType, orderMode, orderStatus } = order;
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
    let _duration = `${duration} mins`;
    if (duration > 1440) {
      _duration = `${Math.floor(duration / 1440)} day(s)`;
      if (duration % 1440 > 0) {
        _duration = `${_duration} ${duration % 1440} hr(s)`;
      }
    } else if (duration > 60) {
      _duration = `${Math.floor(duration / 60)} hr`;
      if (duration % 60 > 0) {
        _duration = `${_duration} ${duration % 60} mins`;
      }
    }
    message = `${message}
Duration:\t${_duration}
Frequency:\t${interval.minutes} mins
    `;
  }

  if (order.orderType === EOrderType.Dca) {
    message = `${message}\n${generateTradeDetailsForDCA(order as IDcaOrder)}`;
  }

  if (txn) {
    message = `${message}\n
Transaction Hash: ${txn}
    `;
  }
  return message;
}

function generateTradeDetailsForDCA(order: IDcaOrder) {
  const { buyToken, sellToken, sellAmount, buyAmount } = order;
  let tokenBought = `Token Bought: ${buyToken?.symbol}
Token Address: ${buyToken?.contractAddress}
Amount bought: ${buyAmount} ${buyToken.symbol}\n\t\t-----`;

  let tokenSold = `Token Sold: ${sellToken?.symbol}
Token Address: ${sellToken?.contractAddress}
Amount Sold: ${sellAmount} ${sellToken.symbol}\n\t\t-----`;

  return `Trade Details\n============\n${tokenBought}\n${tokenSold}`;
}
