import { ethers, logger } from 'ethers';
import { TAPT_API_ENDPOINT, UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '../utils/constants';
import { makeNetworkRequest } from '../utils/networking';
import { fromChainIdToNetwork, getProvider } from '../utils/providers';
import { ENetwork, EOrderStatus, EOrderType, IDcaOrder, TransactionState } from '../utils/types';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { Token } from '@uniswap/sdk-core';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { decrypt } from '../utils/crypto';
import { executeRoute, generateRoute } from '../utils/routing';
import { SwapRoute } from '@uniswap/smart-order-router';
import { createScheduleFunction } from '../utils/firebase-functions';
import { handleError } from '../utils/responseHandler';
import { composeOrderNotificationText, wrapNativeToken } from '../utils/helpers';

function shouldDcaOrderBeExecuted(createdAt: string, interval: { minutes?: number; hours?: number }) {
  const currentDt = Date.now();
  const createdAtDt = new Date(createdAt).getTime();

  const timeDiffInMs = currentDt - createdAtDt;
  const timeDiffInMinutes = Math.floor(timeDiffInMs / 60000);
  console.log('timeDiffInMinutes', timeDiffInMinutes);
  if (interval.hours) {
    return timeDiffInMinutes % (interval.hours * 60) === 0;
  } else if (interval.minutes) {
    console.log('interval.minutes', interval.minutes);
    return timeDiffInMinutes % interval.minutes === 0;
  }

  return false;
}

export async function executeDcaOrders() {
  const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders?orderType=${EOrderType.Dca}&orderStatus=${EOrderStatus.Submitted}`;
  const orders = await makeNetworkRequest<IDcaOrder[]>(fetchReadyToExecuteOrderUrl);

  console.log('orders', orders);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    order: IDcaOrder;
    tokenInput: Token;
    tokenOutput: Token;
    network: ENetwork;
    route?: SwapRoute;
    wallet: ethers.Wallet;
  }[] = [];

  const tokensDetailsPromise = orders.map((order) => {
    const { createdAt, interval, chainId, buyToken, sellToken, encryptedPrivateKey } = order;
    console.log('order', order);
    if (!createdAt) {
      return undefined;
    }
    const shouldExecuteDcaOrder = shouldDcaOrderBeExecuted(createdAt, interval);
    console.log('shouldDcaOrderBeExecuted', shouldExecuteDcaOrder);

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

      additionalParams.push({ order, tokenInput, tokenOutput, network, wallet });

      const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
      return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
    }
    return undefined;
  });
  const tokenDetailsResult = await Promise.allSettled(tokensDetailsPromise);
  logger.debug('tokenDetailsResult', tokenDetailsResult);

  // Quote current market price for Target Token
  const quotedAmountsPromises = tokenDetailsResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }

    const { tokenInput, tokenOutput, order, network } = additionalParams[idx];
    const provider = getProvider(network);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);

    const decimals = order.orderMode === 'sell' ? tokenInput.decimals : tokenOutput.decimals;
    const [token0, token1, fee] = result.value;
    const amountIn = ethers.utils.parseUnits('1', decimals);
    return quoterContract.callStatic.quoteExactInputSingle(token0, token1, fee, amountIn, 0);
  });
  const quotedAmountResults = await Promise.allSettled(quotedAmountsPromises);
  logger.debug('quotedAmountResults', quotedAmountResults);

  await Promise.allSettled(
    quotedAmountResults.map((result, idx) => {
      if (result.status === 'rejected' || !result.value) {
        return undefined;
      }

      const { order, wallet, network } = additionalParams[idx];
      if (order.orderMode === 'sell') {
        return undefined;
      }
      return wrapNativeToken(wallet, network, Number(order.sellAmount));
    }),
  );

  // check whether the quoted price is fall into DCA Price ranges
  const genRoutesPromises = quotedAmountResults.map((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      const { tokenOutput, tokenInput, order, wallet, network } = additionalParams[idx];
      const { orderMode, minPrice, maxPrice, sellAmount } = order;
      const baseSymbol = orderMode === 'sell' ? tokenOutput.symbol : tokenInput.symbol;
      const targetSymbol = orderMode === 'sell' ? tokenInput.symbol : tokenOutput.symbol;
      const decimals = orderMode === 'sell' ? tokenOutput.decimals : tokenInput.decimals;
      console.log('decimals', decimals);
      const amountOut = ethers.utils.formatUnits(result.value, decimals);
      logger.debug(`1 ${baseSymbol} can be swapped for ${amountOut} ${targetSymbol}`);
      console.log('amountOut', amountOut);
      if (Number(amountOut) <= maxPrice && Number(amountOut) >= minPrice) {
        // ready to execute
        return generateRoute(wallet, network, { tokenIn: tokenInput, tokenOut: tokenOutput, amount: Number(sellAmount) });
      }
    }
    return undefined;
  });
  const genRoutesResults = await Promise.allSettled(genRoutesPromises);
  console.log('genRoutesResults', genRoutesResults);

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
  console.log('execRoutesResults', execRoutesResults);

  await Promise.allSettled(
    execRoutesResults.map((result, idx) => {
      if (result.status === 'rejected' || !result.value) {
        return undefined;
      }
      const res = result.value;
      let orderStatus = EOrderStatus.DcaExecuted;
      if (res === TransactionState.Failed) {
        // failed update db
        orderStatus = EOrderStatus.Failed;
      }
      const { order, route } = additionalParams[idx];
      const message = composeOrderNotificationText(
        {
          ...order,
          orderStatus,
          buyAmount: route?.quote.toExact(),
        },
        (res as ethers.providers.TransactionResponse).hash,
      );
      return makeNetworkRequest(`${TAPT_API_ENDPOINT}/notifications`, 'POST', {
        userId: order.userId,
        message,
      });
    }),
  );
  console.log('execRoutesResults', execRoutesResults);

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
