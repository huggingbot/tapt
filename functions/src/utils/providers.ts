/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

import { ethers, providers } from 'ethers';
import { ENetwork } from './types';
import { AppConfig } from './constants';

const mainnetProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Mainnet].rpc);
const polygonProvider = new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Polygon].rpc);

/* eslint-disable valid-jsdoc */
export function getProvider(network: ENetwork): providers.BaseProvider {
  if (network === ENetwork.Local) {
    return new ethers.providers.JsonRpcProvider(AppConfig[ENetwork.Local].rpc);
  } else if (network === ENetwork.Polygon) {
    return polygonProvider;
  }
  return mainnetProvider;
}
