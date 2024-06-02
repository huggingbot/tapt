import JSBI from 'jsbi';

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
