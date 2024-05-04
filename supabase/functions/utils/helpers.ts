/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { BigNumber, ethers, providers, Wallet } from 'npm:ethers@5.7.2';
import jsbi from 'npm:jsbi@3.1.4';

import { AppConfig } from './config.ts';
import { ENetwork } from './constants.ts';
import { TransactionState } from './types.ts';

const JSBI = jsbi.default;
const mainnetProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Mainnet].rpc);
const polygonProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Polygon].rpc);

export async function getPoolImmutables(contract: ethers.Contract) {
  const [token0, token1, fee] = await Promise.all([contract.token0(), contract.token1(), contract.fee()]);
  const immutables = { token0, token1, fee };
  return immutables;
}

export function getProvider(network: ENetwork): providers.BaseProvider {
  if (network === ENetwork.Local) {
    return new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Local].rpc);
  } else if (network === ENetwork.Polygon) {
    return polygonProvider;
  }
  return mainnetProvider;
}

export function fromReadableAmount(amount: number, decimals: number): jsbi.default {
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;
  return JSBI.divide(JSBI.multiply(JSBI.BigInt(adjustedAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))), JSBI.BigInt(extraDigits));
}

export function toReadableAmount(rawAmount: number, decimals: number): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSBI.divide(JSBI.BigInt(rawAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))).toString();
}

function countDecimals(x: number) {
  if (Math.floor(x) === x) {
    return 0;
  }
  return x.toString().split('.')[1].length || 0;
}

export async function sendTransaction(
  wallet: Wallet,
  network: ENetwork,
  transaction: ethers.providers.TransactionRequest,
): Promise<ethers.providers.TransactionResponse | TransactionState> {
  const provider = getProvider(network);
  if (!provider) {
    return TransactionState.Failed;
  }

  if (transaction.value) {
    transaction.value = BigNumber.from(transaction.value);
  }

  const walletWithProvider = wallet.connect(provider);
  const txRes: ethers.providers.TransactionResponse = await walletWithProvider.sendTransaction(transaction);
  return txRes;
}
