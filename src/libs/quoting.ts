import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';

import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';

import { AppConfig, ENetwork } from './config';
import { UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS, WRAPPED_NATIVE_TOKEN } from './constants';
import { getProvider } from './providers';

export const quoteTokenPrice = async (contract: IWizContractProp, network: ENetwork, targetPrice?: unknown) => {
  // firstly, we calculate current market price based on
  // 1 WETH = X TOKEN
  const chainId = AppConfig[network].chainId;
  const token = new Token(chainId, contract.address, contract.decimals, contract.symbol, contract.name);
  const wNativeToken = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;

  // get tokenpool
  const currentPoolAddress = computePoolAddress({
    factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
    tokenA: token,
    tokenB: wNativeToken,
    fee: FeeAmount.MEDIUM,
  });
  const provider = getProvider(network);
  const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);

  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);
  const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], Quoter.abi, provider);
  const baseAmount = ethers.utils.parseUnits('1', wNativeToken.decimals).toString();
  let quotedAmount = await quoterContract.callStatic.quoteExactOutputSingle(token0, token1, fee, baseAmount, 0);

  const variation = (targetPrice as string) || '1%';
  // check if target price is percentage value
  if (variation.trim().endsWith('%')) {
    const pctMatches = variation.trim().match(/\d+/);
    if (!pctMatches?.[0]) {
      throw new Error('invalid percentage value');
    }
    console.log('pctMatches', pctMatches);
    const pctNumber = pctMatches[0];
    const variationPercentage = quotedAmount.mul(ethers.BigNumber.from(pctNumber)).div(100);
    if (variation.trim().startsWith('-')) {
      // negative percentage
      quotedAmount = quotedAmount.sub(variationPercentage);
    } else {
      quotedAmount = quotedAmount.add(variationPercentage);
    }
  }
  const finalTargetPrice = ethers.utils.formatUnits(quotedAmount, token.decimals);
  return finalTargetPrice;
};
