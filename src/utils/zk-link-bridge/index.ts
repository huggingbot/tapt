import { BigNumber, BigNumberish, ethers, Wallet } from 'ethers';
import { Provider } from 'zksync-web3-nova/dist/src/provider';
import { L1Signer } from 'zksync-web3-nova/dist/src/signer';

import { BridgeContractAddresses, ETH_ADDRESS } from './constants';
import { retry } from './utils';

export const getL1Signer = (wallet: Wallet, signer: ethers.providers.JsonRpcSigner, zkLinkRpcUrl: string, network: string) => {
  const zkLinkProvider = new Provider(zkLinkRpcUrl);
  const contracts = BridgeContractAddresses[network];
  zkLinkProvider.setContractAddresses('ethereum', contracts);
  zkLinkProvider.setIsEthGasToken(true);
  const eraL1Signer = L1Signer.from(wallet, signer, zkLinkProvider);
  return eraL1Signer;
};

export const commitTransaction = async (
  l1Signer: L1Signer,
  transaction: {
    to: string;
    tokenAddress: string;
    amount: BigNumberish;
    toMerge?: boolean;
  },
  fee: {
    maxFeePerGas?: BigNumber;
    maxPriorityFeePerGas?: BigNumber;
    gasPrice?: BigNumber;
    baseCost?: BigNumber;
    l1GasLimit: BigNumber;
    l2GasLimit?: BigNumber;
    extraCost: BigNumber;
  },
) => {
  try {
    const overrides = {
      gasPrice: fee.gasPrice,
      gasLimit: fee.l1GasLimit,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    };
    if (overrides.gasPrice && overrides.maxFeePerGas) {
      overrides.gasPrice = undefined;
    }

    const depositResponse = await l1Signer.deposit({
      to: transaction.to,
      token: transaction.tokenAddress,
      amount: transaction.amount,
      toMerge: transaction.toMerge,
      l2GasLimit: fee.l2GasLimit,
      overrides,
    });

    return depositResponse;
  } catch (err) {
    console.error(err);
  }
};

const getGasPrice = async (provider: ethers.providers.JsonRpcProvider) => {
  return BigNumber.from(await retry(() => provider.getGasPrice()))
    .mul(110)
    .div(100);
};

export const getEthTransactionFee = async (signer: L1Signer, provider: ethers.providers.JsonRpcProvider) => {
  if (!signer) throw new Error('Signer is not available');

  return retry(
    async (): Promise<{
      maxFeePerGas?: BigNumber;
      maxPriorityFeePerGas?: BigNumber;
      gasPrice?: BigNumber;
      baseCost?: BigNumber;
      l1GasLimit: BigNumber;
      l2GasLimit?: BigNumber;
      extraCost: BigNumber;
    }> => {
      try {
        const fee = await signer.getFullRequiredDepositFee({
          token: ETH_ADDRESS,
          to: undefined,
        });
        if (!fee) {
          throw new Error('Failed to get fee');
        }
        if (!fee.maxFeePerGas) {
          fee.gasPrice = await getGasPrice(provider);
        }
        return fee;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Not enough balance for deposit.')) {
          const match = err.message.match(/([\d\\.]+) ETH/);
          if (match?.length) {
            const ethAmount = match[1].split(' ')?.[0];
            console.log('Recommended balance:', ethAmount);
          }
        }
        throw err;
      }
    },
  );
};
