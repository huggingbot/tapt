import { SupportedChainId, Token } from '@uniswap/sdk-core';

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

export const WETH_TOKEN = new Token(SupportedChainId.MAINNET, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
export const V3_SWAP_ROUTER02_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
export const ETH_UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const ETH_UNISWAP_V3_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

export const TAPT_API_ENDPOINT = 'https://8560-116-15-207-96.ngrok-free.app/api';

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
