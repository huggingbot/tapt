import { BigNumber, ethers, providers, Wallet } from 'ethers';

import { AppConfig, ENetwork } from './config';

// Single copies of provider and wallet
const mainnetProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Mainnet].rpc);
const polygonProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Polygon].rpc);

// Interfaces

export enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
}

// Provider and Wallet Functions

export function getProvider(network: ENetwork): providers.BaseProvider {
  if (network === ENetwork.Local) {
    return new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Local].rpc);
  } else if (network === ENetwork.Polygon) {
    return polygonProvider;
  }
  return mainnetProvider;
}

export async function sendTransaction(
  wallet: Wallet,
  network: ENetwork,
  transaction: ethers.providers.TransactionRequest,
): Promise<ethers.providers.TransactionResponse | TransactionState> {
  return sendTransactionViaWallet(wallet, network, transaction);
}

// Internal Functionality

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
