import { SupportedChainId } from '@uniswap/sdk-core';

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

export const AppConfig: IAppConfig = {
  [ENetwork.Local]: {
    chainId: SupportedChainId.MAINNET,
    rpc: 'http://127.0.0.1:8545',
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
