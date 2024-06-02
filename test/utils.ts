import { ENetwork } from '@/libs/config';

export const populateWallets = () => {
  return { [ENetwork.Local]: [], [ENetwork.Mainnet]: [], [ENetwork.EthereumSepolia]: [], [ENetwork.Polygon]: [], [ENetwork.ZkLink]: [] };
};
