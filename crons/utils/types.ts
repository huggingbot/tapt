export interface IToken {
  symbol: string;
  chainId: number;
  contractAddress: string;
  decimalPlaces: number;
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
  walletAddress: string;
  encryptedPrivateKey: string;
  buyToken: IToken;
  sellToken: IToken;
  orderStatus: string;
  targetPrice: number;
  buyAmount: string;
  sellAmount: string;
  expirationDate?: string;
  createdAt?: string;
  updatedAt?: string;
  transactionHash: null | string;
  transactionType: null | string;
}

export interface ITransaction {
  id: number;
  walletId: number;
  orderId: number;
  fromAddress: string | null;
  toAddress: string | null;
  transactionHash: string;
  transactionFee: number | null;
  transactionType: string;
  transactionStatus: string;
}

export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
}
