import { ENetwork } from '@/libs/config';

export interface IAppContext {
  requestId: string;
  sourceIp: string;
}

export interface IBasicWallet {
  walletAddress: string;
  chainId: number;
  network: ENetwork;
}
