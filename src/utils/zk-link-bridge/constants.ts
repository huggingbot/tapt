import { ENetwork } from '@/libs/config';

export const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

export const InternalProviderUrl: Record<string, string> = {
  [ENetwork.Local]: 'https://eth-mainnet.g.alchemy.com/v2/pr8u1gRyj3zrfU07224m8DYeq2LeW0d-',
  [ENetwork.Mainnet]: 'https://eth-mainnet.g.alchemy.com/v2/pr8u1gRyj3zrfU07224m8DYeq2LeW0d-',
  [ENetwork.EthereumSepolia]: 'https://eth-sepolia.g.alchemy.com/v2/s42qdWodFgxqeZCtX3m6SKMDjEfuzNzq',
};

export const ZkLinkProviderUrl: Record<string, string> = {
  [ENetwork.Local]: 'https://rpc.zklink.io',
  [ENetwork.Mainnet]: 'https://rpc.zklink.io',
  [ENetwork.EthereumSepolia]: 'https://sepolia.rpc.zklink.io',
};

export const BridgeContractAddresses: Record<string, Record<string, string | string[]>> = {
  [ENetwork.Local]: {
    mainContract: '0x5fD9F73286b7E8683Bab45019C94553b93e015Cf',
    erc20BridgeL1: '0xAd16eDCF7DEB7e90096A259c81269d811544B6B6',
    erc20BridgeL2: '0x36CaABbAbfB9C09B722d9C3697C3Cb4A93650ea7',
    l1Gateway: '0x83Bc7394738A7A084081aF22EEC0051908c0055c',
    wethContract: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  },
  [ENetwork.Mainnet]: {
    mainContract: '0x5fD9F73286b7E8683Bab45019C94553b93e015Cf', // ZkLink contract in ethereum
    erc20BridgeL1: '0xAd16eDCF7DEB7e90096A259c81269d811544B6B6', // Ethereum's erc20 bridge
    erc20BridgeL2: '0x36CaABbAbfB9C09B722d9C3697C3Cb4A93650ea7', // ZkLink nova's erc20 bridge
    l1Gateway: '0x83Bc7394738A7A084081aF22EEC0051908c0055c', // Ethereum gateway (used by zkLink contract in ethereum)
    wethContract: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  },
  [ENetwork.EthereumSepolia]: {
    mainContract: '0x9719cD314BBf84B18aAEDEF56DF88E2267aA01e3',
    erc20BridgeL1: '0x63e059BDEDeA829c22EfA31CbaDb9bea5E86c3Cd',
    erc20BridgeL2: '0xcc43208B28B1eC25F000EfC0D2c2aF044715F888',
    l1Gateway: '0xc6EbbD78E8f81626Bc62570f3C5949221F87b3Ee',
    wethContract: ['0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'],
  },
};
