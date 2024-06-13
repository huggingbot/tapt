import { ENetwork } from '@/libs/config';

import { EOrderType } from './db';

export interface IAppContext {
  requestId: string;
  sourceIp: string;
}

export type TradeMode = 'buy' | 'sell';

export interface IBasicWallet {
  walletAddress: string;
  chainId: number;
  network: ENetwork;
}

export interface IToken {
  symbol: string;
  chainId: number;
  contractAddress: string;
  decimalPlaces: number;
}

export interface IBaseOrder {
  orderId: number;
  walletId: number;
  chainId: number;
  walletAddress: string;
  encryptedPrivateKey: string;
  orderStatus: string;
  buyAmount: string;
  sellAmount: string;
  sell_token: null | IToken;
  buy_token: null | IToken;
  transactionHash: null | string;
  transactionType: null | string;
  orderType: string;
  orderMode: null | string;
  createdAt: Date;
  updatedAt: null | Date;
}

export interface ILimitOrder extends IBaseOrder {
  targetPrice: number;
  expirationDate?: string;
}

export interface IDcaOrder extends IBaseOrder {
  maxPrice: number;
  minPrice: number;
  interval: number;
  duration: number;
}
