export const ERC20_ABI = [
  // Read-Only Functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',

  // Authenticated Functions
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address _spender, uint256 _value) returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
];

export const TAPT_API_ENDPOINT = 'https://0251-103-100-175-163.ngrok-free.app/api';

// order status
export enum EOrderStatus {
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
}
