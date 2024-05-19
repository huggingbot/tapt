import type { ColumnType } from 'kysely';
import type { IPostgresInterval } from 'postgres-interval';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Interval = ColumnType<IPostgresInterval, IPostgresInterval | number, IPostgresInterval | number>;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Order {
  buyAmount: Numeric;
  buyTokenId: number;
  createdAt: Generated<Timestamp>;
  expirationDate: Timestamp | null;
  frequency: number | null;
  id: Generated<number>;
  interval: Interval | null;
  maxPrice: Numeric | null;
  minPrice: Numeric | null;
  orderMode: string | null;
  orderStatus: string;
  orderType: string;
  sellAmount: Numeric;
  sellTokenId: number;
  targetPrice: Numeric | null;
  updatedAt: Timestamp | null;
  walletId: number;
}

export interface Token {
  chainId: number;
  contractAddress: string;
  createdAt: Generated<Timestamp>;
  decimalPlaces: number;
  id: Generated<number>;
  name: string;
  symbol: string;
  updatedAt: Timestamp | null;
}

export interface Transaction {
  createdAt: Generated<Timestamp>;
  fromAddress: string | null;
  id: Generated<number>;
  orderId: number | null;
  toAddress: string | null;
  transactionFee: Numeric | null;
  transactionHash: string;
  transactionStatus: string;
  transactionType: string;
  updatedAt: Timestamp | null;
  walletId: number;
}

export interface User {
  createdAt: Generated<Timestamp>;
  id: Generated<number>;
  telegramId: Int8;
  updatedAt: Timestamp | null;
  username: string;
}

export interface Wallet {
  chainId: number;
  createdAt: Generated<Timestamp>;
  encryptedPrivateKey: string;
  id: Generated<number>;
  updatedAt: Timestamp | null;
  userId: number;
  walletAddress: string;
}

export interface DB {
  order: Order;
  token: Token;
  transaction: Transaction;
  user: User;
  wallet: Wallet;
}
