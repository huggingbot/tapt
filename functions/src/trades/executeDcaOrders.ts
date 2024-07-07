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
  if (interval.hours) {
    return timeDiffInMinutes % (interval.hours * 60) === 0;
  } else if (interval.minutes) {
    return timeDiffInMinutes % interval.minutes === 0;
  }

  return false;
}

export async function executeDcaOrders() {
  const fetchReadyToExecuteOrderUrl = `${TAPT_API_ENDPOINT}/orders?orderType=${EOrderType.Dca}&orderStatus=${EOrderStatus.Submitted}`;
  const orders = await makeNetworkRequest<IDcaOrder[]>(fetchReadyToExecuteOrderUrl);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    order: IDcaOrder;
    tokenInput: Token;
    tokenOutput: Token;
    network: ENetwork;
    route?: SwapRoute;
    wallet: ethers.Wallet;
  }[] = [];

  const tokensDetailsPromises = orders.map((order) => {
    const { createdAt, interval, chainId, buyToken, sellToken, encryptedPrivateKey } = order;
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

      additionalParams.push({ order, tokenInput, tokenOutput, network, wallet });

      const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
      return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
    }
    return undefined;
  });
  const tokenDetailsResults = await Promise.allSettled(tokensDetailsPromises);
  logger.debug('tokenDetailsResult', tokenDetailsResults);
  console.log('tokenDetailsResult', tokenDetailsResults);

  // Quote current market price for Target Token
  const quotedAmountsPromises = tokenDetailsResults.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }

    const { tokenInput, tokenOutput, network } = additionalParams[idx];
    const provider = getProvider(network);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);

    const [fee] = result.value;

    // in buy mode, tokenInput will be the wrapped native token; tokenOutput will be the erc20 token
    // in sell mode, tokenInput will be the erc20 token; tokenOutput will be the wrapped native token
    const amountIn = ethers.utils.parseUnits('1', tokenInput.decimals);
    return quoterContract.callStatic.quoteExactInputSingle(tokenInput.address, tokenOutput.address, fee, amountIn, 0);
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
      // In the 'buy' mode, we are buying 'X' token with Native ETH
      // In order to do the trade (swap), we need to convert ETH to WETH
      // so here, we're wrapping the ETH to convert to WETH
      return wrapNativeToken(wallet, network, Number(order.sellAmount));
    }),
  );

  // check whether the quoted price is fall into DCA Price ranges
  const genRoutesPromises = quotedAmountResults.map((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      const { tokenOutput, tokenInput, order, wallet, network } = additionalParams[idx];
      const { orderMode, minPrice, maxPrice, sellAmount } = order;

      // here, we format the `quotedPrice` with the native token decimal
      // In 'buy' mode, 'X' token is tokenOutput in DB
      // In 'sell' mode, 'X' token is stored as tokenInput in DB
      let nativeTokenDecimals = tokenInput.decimals;
      // this is for debugging and logging purpose
      let nativeTokenSymbol = tokenInput.symbol;
      let targetTokenSymbol = tokenOutput.symbol;
      if (orderMode === 'sell') {
        nativeTokenDecimals = tokenOutput.decimals;
        nativeTokenSymbol = tokenOutput.symbol;
        targetTokenSymbol = tokenInput.symbol;
      }

      const amountOut = ethers.utils.formatUnits(result.value, nativeTokenDecimals);
      console.log(`1 ${targetTokenSymbol} can be swapped for ${amountOut} ${nativeTokenSymbol}`);

      // check whether the current market price falls inside the DCA price ranges
      if (Number(amountOut) <= maxPrice && Number(amountOut) >= minPrice) {
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
