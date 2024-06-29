export enum EOrderType {
  Market = 'market',
  Limit = 'limit',
  Dca = 'dca',
}

export enum EOrderStatus {
  Active = 'ACTIVE', // aggregate status for all active orders, i.e. not completed, expired, failed or cancelled
  Expired = 'EXPIRED',
  Cancelled = 'CANCELLED',
  Failed = 'FAILED',

  /**
   * Below are the order status related to limit orders
   * TODO:  review this order statuses again once the order execution pipeline is stable
   *
   */
  // initial state of the limit order
  Submitted = 'ORDER_SUBMITTED',
  // after submitting approval txn
  ApprovalPending = 'APPROVAL_PENDING',
  // after getting approval
  ApprovalCompleted = 'APPROVAL_COMPLETED',
  // when limit order criteria is met
  ExecutionReady = 'READY_TO_EXECUTE',
  ExecutionStarted = 'EXECUTION_STARTED',
  // send transaction for the order execution
  ExecutionPending = 'EXECUTION_PENDING',
  // after order has been executed successfully
  Completed = 'ORDER_COMPLETED',
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
