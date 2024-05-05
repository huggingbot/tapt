import { Contract, providers } from 'ethers';

import ERC20_ABI from '../contracts/ERC_20_abi.json';
import { ENetwork } from './config';
import { WRAPPED_NATIVE_TOKEN_ABI, WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS } from './constants';

export const getWrappedNativeTokenContract = (network: ENetwork, provider: providers.Provider): Contract => {
  return new Contract(WRAPPED_NATIVE_TOKEN_CONTRACT_ADDRESS[network], WRAPPED_NATIVE_TOKEN_ABI, provider);
};

export const getErc20Contract = (tokenAddress: string, provider: providers.Provider): Contract => {
  return new Contract(tokenAddress, ERC20_ABI, provider);
};

export const getErc20CommonProps = async <T extends string | undefined>(
  contract: Contract,
  userAddress?: T,
): Promise<{ name: string; symbol: string; decimals: number; address: string; balance: T extends string ? number : undefined }> => {
  const name = await contract.name();
  const symbol = await contract.symbol();
  const decimals: number = await contract.decimals();

  let balance = undefined as T extends string ? number : undefined;
  if (userAddress) {
    balance = await contract.balanceOf(userAddress);
  }
  return { name, symbol, decimals, address: contract.address, balance };
};
