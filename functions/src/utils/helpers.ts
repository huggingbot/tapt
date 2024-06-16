import { Wallet } from 'ethers';
import JSBI from 'jsbi';
import { WRAPPED_NATIVE_TOKEN, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS } from './constants';
import { getWrappedNativeTokenContract } from './constracts';
import { getProvider } from './providers';
import { ENetwork } from './types';
import { sendTransactionViaWallet } from './transactions';

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
