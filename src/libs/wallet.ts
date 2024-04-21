import { Wallet } from 'ethers';

import { ENetwork } from './config';
import { MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS, WRAPPED_NATIVE_TOKEN, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS } from './constants';
import { getWrappedNativeTokenContract } from './contracts';
import { fromReadableAmount } from './conversion';
import { getProvider, sendTransaction } from './providers';

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

  await sendTransaction(wallet, network, transaction);
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

  await sendTransaction(wallet, network, transaction);
}
