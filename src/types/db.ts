export enum EOrderType {
  Market = 'market',
  Limit = 'limit',
  Dca = 'dca',
}

export enum EOrderStatus {
  Active = 'active',
  Pending = 'pending',
  PartiallyFilled = 'partially_filled',
  Filled = 'filled',
  Cancelled = 'cancelled',
}

export enum ETransactionType {
  Swap = 'swap',
  Deposit = 'deposit',
  Withdraw = 'withdraw',
}

export enum ETransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}
