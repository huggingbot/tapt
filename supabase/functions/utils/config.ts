import { SupportedChainId } from 'npm:@uniswap/sdk-core@3.2.3';

import { ENetwork } from './constants.ts';
import { IAppConfig } from './types.ts';

export const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/pr8u1gRyj3zrfU07224m8DYeq2LeW0d-';
export const ETH_UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const ETH_UNISWAP_V3_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
export const ETH_UNISWAP_V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
export const TAPT_BACKEND_API_URL = 'https://7893-116-15-207-96.ngrok-free.app/api';

export const AppConfig: IAppConfig = {
  [ENetwork.Local]: {
    chainId: SupportedChainId.MAINNET,
    rpc: 'https://a64e-116-15-207-96.ngrok-free.app',
  },
  [ENetwork.Mainnet]: {
    chainId: SupportedChainId.MAINNET,
    rpc: 'https://eth-mainnet.g.alchemy.com/v2/pr8u1gRyj3zrfU07224m8DYeq2LeW0d-',
  },
  [ENetwork.Polygon]: {
    chainId: SupportedChainId.POLYGON,
    rpc: 'https://polygon-mainnet.g.alchemy.com/v2/wPrQvdrfzHVq-S7smKWTCANvAhM6SiZW',
  },
};
