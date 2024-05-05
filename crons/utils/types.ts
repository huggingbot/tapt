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
  wallet: IBasicWallet;
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
  success: boolean;
  message?: string;
}
