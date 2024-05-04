import { ENetwork } from './constants.ts';

export interface IToken {
  symbol: string;
  chainId: number;
  contractAddress: string;
  decimalPlaces: number;
}

export interface IBasicWallet {
  wallet_address: string;
  encryted_private_key: string;
}

export enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
}

export interface ILimitOrder {
  id: number;
  walletId: number;
  basicWallet: IBasicWallet;
  buyToken: IToken;
  sellToken: IToken;
  orderStatus: string;
  targetPrice: number;
  buyAmount: string;
  sellAmount: string;
  expirationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string; // error message
  success: boolean;
}

export interface IAppConfig {
  [ENetwork.Local]: {
    chainId: number;
    rpc: string;
  };
  [ENetwork.Mainnet]: {
    chainId: number;
    rpc: string;
  };
  [ENetwork.Polygon]: {
    chainId: number;
    rpc: string;
  };
}
