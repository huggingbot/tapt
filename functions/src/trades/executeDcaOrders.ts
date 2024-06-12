import { ethers, logger } from 'ethers';
import { TAPT_API_ENDPOINT, UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '../utils/constants';
import { makeNetworkRequest } from '../utils/networking';
import { fromChainIdToNetwork, getProvider } from '../utils/providers';
import { ENetwork, EOrderStatus, EOrderType, IDcaOrder, TradeMode } from '../utils/types';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { Token } from '@uniswap/sdk-core';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { decrypt } from '../utils/crypto';
import { executeRoute, generateRoute } from '../utils/routing';
import { SwapRoute } from '@uniswap/smart-order-router';
import { createScheduleFunction } from '../utils/firebase-functions';
import { handleError } from '../utils/responseHandler';

function shouldDcaOrderBeExecuted(createdAt: string, interval: number) {
  const currentDt = Date.now();
  const createdAtDt = new Date(createdAt).getTime();

  const timeDiffInMs = currentDt - createdAtDt;
  const timeDiffInMinutes = Math.floor(timeDiffInMs / 60000);

  return timeDiffInMinutes % interval === 0;
}

export async function executeDcaOrders() {
  const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders?orderType=${EOrderType.Dca}&orderStatus=${EOrderStatus.Submitted}`;
  const orders = await makeNetworkRequest<IDcaOrder[]>(fetchReadyToExecuteOrderUrl);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    minPrice: number;
    maxPrice: number;
    sellAmount: string;
    tokenInput: Token;
    tokenOutput: Token;
    network: ENetwork;
    orderMode?: TradeMode;
    route?: SwapRoute;
    wallet: ethers.Wallet;
  }[] = [];

  // gen token pool address
  const tokenPoolsPromises = orders.map((order) => {
    const { createdAt, interval, chainId, buyToken, sellToken, orderId, minPrice, maxPrice, sellAmount, orderMode, encryptedPrivateKey } = order;
    if (!createdAt) {
      return undefined;
    }
    const shouldExecuteDcaOrder = shouldDcaOrderBeExecuted(createdAt, interval);
    if (shouldExecuteDcaOrder) {
      const network = fromChainIdToNetwork(chainId);
      const provider = getProvider(network);
      const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
      const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);
      const privateKey = decrypt(encryptedPrivateKey);
      const wallet = new ethers.Wallet(privateKey, provider);

      const currentPoolAddress = computePoolAddress({
        factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
        tokenA: tokenOutput,
        tokenB: tokenInput,
        fee: FeeAmount.MEDIUM,
      });

      additionalParams.push({ orderId, minPrice, maxPrice, tokenOutput, tokenInput, sellAmount, network, orderMode, wallet });

      const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
      return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
    }
    return undefined;
  });
  const tokenPoolsResults = await Promise.allSettled(tokenPoolsPromises);

  // get the quoted price
  const quotedAmountsPromises = tokenPoolsResults.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }

    const { tokenInput, tokenOutput, orderMode, network } = additionalParams[idx];

    const provider = getProvider(network);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);
    const decimals = orderMode === 'buy' ? tokenInput.decimals : tokenOutput.decimals;
    const [token0, token1, fee] = result.value;
    const amountIn = ethers.utils.parseUnits('1', decimals);
    return quoterContract.callStatic.quoteExactOutputSingle(token0, token1, fee, amountIn, 0);
  });
  const quotedAmountResults = await Promise.allSettled(quotedAmountsPromises);

  // check whether the quoted price is fall into DCA Price ranges
  const genRoutesPromises = quotedAmountResults.map((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      const { tokenOutput, tokenInput, minPrice, maxPrice, orderMode, network, sellAmount, wallet } = additionalParams[idx];
      const decimals = orderMode === 'buy' ? tokenOutput.decimals : tokenInput.decimals;
      const amountOut = Number(ethers.utils.formatUnits(result.value, decimals));

      if (amountOut <= maxPrice && amountOut >= minPrice) {
        // ready to execute
        return generateRoute(wallet, network, { tokenIn: tokenInput, tokenOut: tokenOutput, amount: Number(sellAmount) });
      }
    }
    return undefined;
  });
  const genRoutesResults = await Promise.allSettled(genRoutesPromises);

  // Execute the trade
  const execRoutesPromises = genRoutesResults.map((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      additionalParams[idx] = { ...additionalParams[idx], route: result.value };
      const { wallet, network } = additionalParams[idx];
      return executeRoute(wallet, network, result.value);
    }
    return undefined;
  });
  const execRoutesResults = await Promise.allSettled(execRoutesPromises);

  return execRoutesResults;
}

export const dcaOrderExecutor = createScheduleFunction(async () => {
  try {
    const result = await executeDcaOrders();
    if (!result) {
      logger.info('[dcaOrderExecutor] none of the `DCA` orders met the criteria');
    } else {
      logger.info('[dcaOrderExecutor] trade criteria met:', result);
    }
  } catch (e: unknown) {
    handleError(e);
  }
});
