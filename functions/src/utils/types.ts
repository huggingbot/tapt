export interface IToken {
  symbol: string;
  chainId: number;
  contractAddress: string;
  decimalPlaces: number;
}

export type TradeMode = 'buy' | 'sell';

export enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
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
  sellToken: IToken;
  buyToken: IToken;
  transactionHash: null | string;
  transactionType: null | string;
  userId: number;
  orderType: EOrderType;
  orderMode?: TradeMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface ILimitOrder extends IBaseOrder {
  targetPrice: number;
  expirationDate?: string;
}

export interface IDcaOrder extends IBaseOrder {
  maxPrice: number;
  minPrice: number;
  interval: {
    hours?: number;
    minutes?: number;
  };
  duration: number;
  expirationDate?: string;
}

export interface ITransaction {
  id: number;
  walletId: number;
  orderId: number;
  chainId: number;
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

export interface IUpdateOrderRequestBody {
  orderStatus: string;
  buyAmount?: number;
  transaction?: { hash: string; type: string; toAddress: string };
}

export enum ETransactionType {
  Swap = 'swap',
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Approval = 'approval',
}

export enum ETransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export enum ENetwork {
  Local = 'local',
  Mainnet = 'mainnet',
  Polygon = 'polygon',
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

export enum EOrderType {
  Market = 'market',
  Limit = 'limit',
  Dca = 'dca',
}

// order status
export enum EOrderStatus {
  Active = 'ACTIVE',
  // initial state of the limit order
  Submitted = 'ORDER_SUBMITTED',
  // after submitting approval txn
  ApprovalPending = 'APPROVAL_PENDING',
  // after getting approval
  ApprovalCompleted = 'APPROVAL_COMPLETED',
  // when limit order criteria is met
  ExecutionReady = 'READY_TO_EXECUTE',
  // send transaction for the order execution
  ExecutionPending = 'EXECUTION_PENDING',
  // after order has been executed successfully
  Completed = 'ORDER_COMPLETED',
  Failed = 'FAILED',
  Expired = 'EXPIRED',
  DcaExecuted = 'DCA_EXECUTED',
}
