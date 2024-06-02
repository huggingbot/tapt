// This file stores web3 related constants such as addresses, token definitions, native currency references and ABI's

import { SupportedChainId, Token } from '@uniswap/sdk-core';

import { ENetwork } from './config';

// Addresses

export const V3_UNISWAP_ROUTER_ADDRESS = {
  [ENetwork.Local]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [ENetwork.Mainnet]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [ENetwork.EthereumSepolia]: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  [ENetwork.Polygon]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
};

export const V3_UNISWAP_FACTORY_ADDRESS = {
  [ENetwork.Local]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [ENetwork.Mainnet]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [ENetwork.Polygon]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
};

export const UNISWAP_QUOTER_ADDRESS = {
  [ENetwork.Local]: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  [ENetwork.Mainnet]: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  [ENetwork.Polygon]: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
};

export const WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS = {
  [ENetwork.Local]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [ENetwork.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [ENetwork.EthereumSepolia]: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  [ENetwork.Polygon]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
};

export const USDC_CONTRACT_ADDRESS = {
  [ENetwork.Local]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [ENetwork.Mainnet]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [ENetwork.Polygon]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
};

// Currencies and Tokens

export const WRAPPED_NATIVE_TOKEN = {
  [ENetwork.Local]: new Token(SupportedChainId.MAINNET, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Mainnet], 18, 'WETH', 'Wrapped Ether'),
  [ENetwork.Mainnet]: new Token(SupportedChainId.MAINNET, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Mainnet], 18, 'WETH', 'Wrapped Ether'),
  [ENetwork.EthereumSepolia]: new Token(
    SupportedChainId.SEPOLIA,
    WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.EthereumSepolia],
    18,
    'WETH',
    'Wrapped Ether',
  ),
  [ENetwork.Polygon]: new Token(SupportedChainId.POLYGON, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[ENetwork.Polygon], 18, 'WMATIC', 'Wrapped Matic'),
};

export const NATIVE_CURRENCY = {
  [ENetwork.Local]: 'ETH',
  [ENetwork.Mainnet]: 'ETH',
  [ENetwork.EthereumSepolia]: 'ETH',
  [ENetwork.Polygon]: 'MATIC',
};

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
