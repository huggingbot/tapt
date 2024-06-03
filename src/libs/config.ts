import { SupportedChainId } from '@uniswap/sdk-core';

export enum ENetwork {
  Local = 'local',
  Mainnet = 'mainnet',
  EthereumSepolia = 'ethereum sepolia',
  Polygon = 'polygon',
  ZkLink = 'zk link',
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
  [ENetwork.EthereumSepolia]: {
    chainId: number;
    rpc: string;
  };
  [ENetwork.Polygon]: {
    chainId: number;
    rpc: string;
  };
  [ENetwork.ZkLink]: {
    chainId: number;
    rpc: string;
  };
}

const LOCAL_FORKED_RPC_URL = process.env.LOCAL_FORKED_RPC_URL || 'https://8e1d-116-15-207-96.ngrok-free.app';

export const AppConfig: IAppConfig = {
  [ENetwork.Local]: {
    chainId: SupportedChainId.MAINNET,
    rpc: LOCAL_FORKED_RPC_URL,
  },
  [ENetwork.Mainnet]: {
    chainId: SupportedChainId.MAINNET,
    rpc: 'https://eth-mainnet.g.alchemy.com/v2/pr8u1gRyj3zrfU07224m8DYeq2LeW0d-',
  },
  [ENetwork.EthereumSepolia]: {
    chainId: SupportedChainId.SEPOLIA,
    rpc: 'https://eth-sepolia.g.alchemy.com/v2/s42qdWodFgxqeZCtX3m6SKMDjEfuzNzq',
  },
  [ENetwork.Polygon]: {
    chainId: SupportedChainId.POLYGON,
    rpc: 'https://polygon-mainnet.g.alchemy.com/v2/wPrQvdrfzHVq-S7smKWTCANvAhM6SiZW',
  },
  [ENetwork.ZkLink]: {
    chainId: 810180,
    rpc: 'https://rpc.zklink.io',
  },
};
