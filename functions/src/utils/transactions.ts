/* eslint-disable max-len */
import { Wallet, ethers, BigNumber } from 'ethers';
import { getProvider } from './providers';
import { ENetwork, TransactionState } from './types';

/**
 * Send txn via ethers wallet
 * @param {Wallet} wallet - ethers wallet
 * @param {ENetwork} network - chain network
 * @param {ethers.providers.TransactionRequest} transaction - transaction request to be sent
 * @return {ethers.providers.TransactionResponse | TransactionState} result from sending transaction
 */
export async function sendTransactionViaWallet(
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
  const txRes = await walletWithProvider.sendTransaction(transaction);
  return txRes;
}
