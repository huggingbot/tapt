import JSBI from 'jsbi';

import { ENetwork } from './config';

export function fromReadableAmount(amount: number, decimals: number): JSBI {
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;
  return JSBI.divide(JSBI.multiply(JSBI.BigInt(adjustedAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))), JSBI.BigInt(extraDigits));
}

export function toReadableAmount(rawAmount: number | string, decimals: number): string {
  return JSBI.divide(JSBI.BigInt(rawAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))).toString();
}

function countDecimals(x: number) {
  if (Math.floor(x) === x) {
    return 0;
  }
  return x.toString().split('.')[1].length || 0;
}

export function fromChainIdToNetwork(chainId: number): ENetwork {
  if (chainId === 1) {
    return ENetwork.Local;
  } else if (chainId === 137) {
    return ENetwork.Polygon;
  }
  return ENetwork.Local;
}
