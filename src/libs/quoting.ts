import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';

import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { isValidPercentageValue } from '@/utils/common';

import { AppConfig, ENetwork } from './config';
import { UNISWAP_QUOTER_ADDRESS, USDC_CONTRACT_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS, WRAPPED_NATIVE_TOKEN } from './constants';
import { getErc20CommonProps, getErc20Contract } from './contracts';
import { getProvider } from './providers';

const getPoolImmutables = async (contract: ethers.Contract) => {
  const [token0, token1, fee] = await Promise.all([contract.token0(), contract.token1(), contract.fee()]);
  const immutables = { token0, token1, fee };
  return immutables;
};

const createUSDCToken = async (network: ENetwork) => {
  const chainId = AppConfig[network].chainId;
  const USDC_ADDRESS = USDC_CONTRACT_ADDRESS[network];
  const provider = getProvider(network);
  const erc20USDCContract = getErc20Contract(USDC_ADDRESS, provider);
  const { address, decimals, symbol, name } = await getErc20CommonProps(erc20USDCContract);
  return new Token(chainId, address, decimals, symbol, name);
};

/**
 *
 * @param {Token} tokenOut - token to buy
 * @param {ENetwork} network - chain network
 * @param {Token} tokenIn - token to sell
 * @param {string} amountIn - sell amount
 * @returns
 */
export const quoteTokenPrice = async (tokenOut: Token, network: ENetwork, tokenIn?: Token, amount?: string) => {
  // Firstly, we gonna need to chose which token we'll use as based to compute price
  const wNativeToken = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
  const sellToken = tokenIn || wNativeToken;
  // get tokenpool
  const currentPoolAddress = computePoolAddress({
    factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
    tokenA: tokenOut,
    tokenB: sellToken,
    fee: FeeAmount.MEDIUM,
  });
  const provider = getProvider(network);
  const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
  console.log('poolContract', poolContract.address);
  const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], Quoter.abi, provider);
  const amountToQuote = amount || '1';
  const immutables = await getPoolImmutables(poolContract);
  console.log('immutables', immutables);

  // we will sell WETH
  if (sellToken.address === wNativeToken.address) {
    const amountOut = ethers.utils.parseUnits(amountToQuote.toString(), tokenOut.decimals);
    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(immutables.token0, immutables.token1, immutables.fee, amountOut, 0);
    return quotedAmountOut as ethers.BigNumber;
  }
  // we will buy WETH
  const amountOut = ethers.utils.parseUnits(amountToQuote.toString(), tokenOut.decimals);
  const quotedAmountOut = await quoterContract.callStatic.quoteExactOutputSingle(immutables.token0, immutables.token1, immutables.fee, amountOut, 0);
  return quotedAmountOut as ethers.BigNumber;
};

export const quoteTargetTokenPrice = async (contract: IWizContractProp, network: ENetwork, targetPrice: string) => {
  const chainId = AppConfig[network].chainId;
  const token = new Token(chainId, contract.address, contract.decimals, contract.symbol, contract.name);
  const quotedAmountStr = await computeTokenPriceInUSD(contract, network, targetPrice);
  const USDC_TOKEN = await createUSDCToken(network);
  let quotedAmount = ethers.utils.parseUnits(quotedAmountStr, USDC_TOKEN.decimals);
  // check if target price is percentage value
  if (targetPrice.trim().endsWith('%')) {
    const pctMatches = targetPrice.trim().match(/\d+/);
    if (!pctMatches?.[0]) {
      throw new Error('invalid percentage value');
    }
    const pctNumber = pctMatches[0];
    const variationPercentage = quotedAmount.mul(ethers.BigNumber.from(pctNumber)).div(100);
    if (targetPrice.trim().startsWith('-')) {
      // negative percentage
      quotedAmount = quotedAmount.sub(variationPercentage);
    } else {
      quotedAmount = quotedAmount.add(variationPercentage);
    }
  }
  const finalTargetPrice = ethers.utils.formatUnits(quotedAmount, token.decimals);
  return finalTargetPrice;
};

export const computeTokenPriceInUSD = async (contract: IWizContractProp, network: ENetwork, targetPrice?: string) => {
  const chainId = AppConfig[network].chainId;
  const token = new Token(chainId, contract.address, contract.decimals, contract.symbol, contract.name);
  const USDC_TOKEN = await createUSDCToken(network);

  // if target contract is already USDC and we're just looking for USD value of 1 USDC,
  // we can just return the amount, since USDC has 1:1 with US Dollars
  if (USDC_TOKEN.address === token.address) {
    if (targetPrice?.trim().endsWith('%')) {
      if (!isValidPercentageValue(targetPrice)) {
        throw new Error(`Invalid target price, ${targetPrice}`);
      }
      const pctNum = Number(targetPrice.trim().replace('%', ''));
      const variedVal = 1 + 1 / pctNum;
      return variedVal.toString();
    }
    return targetPrice || '1';
  }

  // compute token price in USD by converting ETH to USD
  // for e.g. if we want to know WTBC token price in USD
  //    WBTC -> WETH = 21.56 WETH
  //   21.56 WETH -> USDC = ???
  const wNativeToken = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
  const quotedAmountInWETH = await quoteTokenPrice(token, network, wNativeToken, targetPrice);
  const quotedAmountInWETHStr = ethers.utils.formatUnits(quotedAmountInWETH, wNativeToken.decimals);
  console.log('quotedAmountInWETHStr', quotedAmountInWETHStr);

  const quotedAmountInUSDC = await quoteTokenPrice(wNativeToken, network, USDC_TOKEN, quotedAmountInWETHStr);
  return ethers.utils.formatUnits(quotedAmountInUSDC, USDC_TOKEN.decimals);
};
