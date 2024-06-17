/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import 'dotenv/config';
import { ethers, providers } from 'ethers';
import { ENetwork } from './types';
import { AppConfig } from './constants';

const mainnetProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Mainnet].rpc);
const polygonProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Polygon].rpc);

export function fromChainIdToNetwork(chainId: number): ENetwork {
  if (chainId === 1) {
    return ENetwork.Mainnet;
  } else if (chainId === 137) {
    return ENetwork.Polygon;
  }
  return ENetwork.Local;
}

/* eslint-disable valid-jsdoc */
export function getProvider(network: ENetwork): providers.BaseProvider {
  const NODE_ENV = process.env.NODE_ENV || 'production';
  if (NODE_ENV === 'development' || network === ENetwork.Local) {
    return new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Local].rpc);
  } else if (network === ENetwork.Polygon) {
    return polygonProvider;
  }
  return mainnetProvider;
}
