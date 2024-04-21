// This file stores web3 related constants such as addresses, token definitions, native currency references and ABI's

import { SupportedChainId, Token } from '@uniswap/sdk-core';

import { ENetwork } from './config';

// Addresses

export const V3_UNISWAP_ROUTER_ADDRESS = {
  [ENetwork.Local]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [ENetwork.Mainnet]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [ENetwork.Polygon]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
};

export const WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS = {
  [ENetwork.Local]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [ENetwork.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [ENetwork.Polygon]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
};

// Currencies and Tokens

export const WRAPPED_NATIVE_TOKEN = {
  [ENetwork.Local]: new Token(SupportedChainId.MAINNET, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Mainnet], 18, 'WETH', 'Wrapped Ether'),
  [ENetwork.Mainnet]: new Token(SupportedChainId.MAINNET, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Mainnet], 18, 'WETH', 'Wrapped Ether'),
  [ENetwork.Polygon]: new Token(SupportedChainId.POLYGON, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Polygon], 18, 'WMATIC', 'Wrapped Matic'),
};

export const NATIVE_CURRENCY = {
  [ENetwork.Local]: 'ETH',
  [ENetwork.Mainnet]: 'ETH',
  [ENetwork.Polygon]: 'MATIC',
};

// ABI's

export const ERC20_ABI = [
  // Read-Only Functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',

  // Authenticated Functions
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address _spender, uint256 _value) returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
];

export const WRAPPED_NATIVE_TOKEN_ABI = [
  // Wrap native token
  'function deposit() payable',

  // Unwrap native token
  'function withdraw(uint wad) public',
];

// Transactions

export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;
export const TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER = 10000;
