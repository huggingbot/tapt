/* eslint-disable max-len */

import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { ENetwork, EOrderStatus, ILimitOrder, IToken, TradeMode } from '../utils/types';
import { TAPT_API_ENDPOINT, UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '../utils/constants';
import { fromChainIdToNetwork, getProvider } from '../utils/providers';
import { logger } from 'firebase-functions';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';
import { composeOrderNotificationText, countdown } from '../utils/helpers';

/**
 * Check if the trade criteria met with the current price and target price
 * @param {TradeMode} orderMode - 'buy' | 'sell'
 * @param {number} amountIn - current market price of the token
 * @param {number} targetPrice - targetted price to exectue the trade if met
 * @return {boolean} True if limit order criteria met, otherwise false
 */
export function isLimitOrderCriteriaMet(orderMode: TradeMode, amountIn: number, targetPrice: number): boolean {
  return (orderMode === 'buy' && amountIn <= targetPrice) || (orderMode === 'sell' && amountIn >= targetPrice);
}

/**
 * This function is responsible for checking
 * the trading criteria in current market based on the order placed
 * If the trading criteria has met, then it will update the backend and db,
 * so that the next function in line can execute the orders
 * In trading crons workflow, we can list this trade as cron number 2
 * For e.g:
 *    limit order: (from up to bottom)
 *    [submit_approval]
 *    [track_txn]
 *    **[check_orders_criteria]
 *    [execute_trade]
 *    [track_txn]
 *    (DONE)
 */
export async function checkLimitOrderCriteria() {
  const start = Date.now();
  const fetchApprovalCompletedOrdersUrl = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ApprovalCompleted}`;
  const orders = await makeNetworkRequest<ILimitOrder[]>(fetchApprovalCompletedOrdersUrl);

  const ordersToBePrcessed: Partial<ILimitOrder>[] = [];
  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    targetPrice: number;
    sellAmount: string;
    tokenInput: Token;
    tokenOutput: Token;
    buyToken: IToken;
    sellToken: IToken;
    orderMode?: TradeMode;
    network: ENetwork;
  }[] = [];
  // compute TokenPool Addr and get Tokens Details
  const tokensDetailsPromise = orders.map((order) => {
    const { orderId, buyToken, sellToken, targetPrice, sellAmount, orderMode, chainId } = order;

    const network = fromChainIdToNetwork(chainId);
    const provider = getProvider(network);
    const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    const currentPoolAddress = computePoolAddress({
      factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
      tokenA: tokenOutput,
      tokenB: tokenInput,
      fee: FeeAmount.MEDIUM,
    });

    additionalParams.push({ orderId, targetPrice, sellAmount, tokenOutput, tokenInput, orderMode, network, buyToken, sellToken });

    const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
    return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
  });
  const tokenDetailsResult = await Promise.allSettled(tokensDetailsPromise);
  // Quote current market price for Target Token
  const quotedAmountsPromises = tokenDetailsResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }

    const { tokenInput, tokenOutput, orderMode, network } = additionalParams[idx];
    const provider = getProvider(network);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);

    const decimals = orderMode === 'buy' ? tokenOutput.decimals : tokenInput.decimals;
    const [token0, token1, fee] = result.value;
    const amountIn = ethers.utils.parseUnits('1', decimals);
    return quoterContract.callStatic.quoteExactInputSingle(token0, token1, fee, amountIn, 0);
  });
  const quotedAmountResults = await Promise.allSettled(quotedAmountsPromises);

  // Validate and check LIMIT_ORDER crtieria
  quotedAmountResults.forEach((result, idx) => {
    const { tokenOutput, tokenInput, orderId, targetPrice, orderMode, buyToken, sellToken, sellAmount } = additionalParams[idx];
    const baseSymbol = orderMode === 'buy' ? tokenInput.symbol : tokenOutput.symbol;
    const targetSymbol = orderMode === 'buy' ? tokenOutput.symbol : tokenInput.symbol;
    const decimals = orderMode === 'buy' ? tokenInput.decimals : tokenOutput.decimals;
    if (result.status === 'fulfilled' && result.value) {
      const amountOut = ethers.utils.formatUnits(result.value, decimals);
      logger.debug('=====================');
      logger.debug(`Target Price: ${targetPrice}`);
      logger.debug(`1 ${baseSymbol} can be swapped for ${amountOut} ${targetSymbol}`);
      logger.debug('=====================');

      if (isLimitOrderCriteriaMet(orderMode || 'buy', Number(amountOut), targetPrice)) {
        // send for approval
        logger.debug(`Limit order condition met for order with id, ${orderId}`);
        ordersToBePrcessed.push({ orderId, targetPrice, orderMode, buyToken, sellToken, sellAmount });
      }
    }
  });
  logger.info(`Checking Limit Orders Criteria takes ${Date.now() - start} ms to complete!`);

  if (ordersToBePrcessed.length > 0) {
    // bulk update orders
    const body = {
      setdata: { orderStatus: EOrderStatus.ExecutionReady },
      idsToUpdate: ordersToBePrcessed.map((o) => o.orderId),
    };
    const resp = await makeNetworkRequest(`${TAPT_API_ENDPOINT}/orders/bulk_update_status`, 'PATCH', body);
    console.log(resp);
  }

  // send notifications
  Promise.all(
    ordersToBePrcessed.map((order) => {
      const message = composeOrderNotificationText({
        ...order,
        orderStatus: EOrderStatus.ExecutionReady,
      });
      return makeNetworkRequest(`${TAPT_API_ENDPOINT}/notifications`, 'POST', {
        userId: order.userId,
        message,
      });
    }),
  );

  return undefined;
}

export const limitOrderCriteriaChecker = createScheduleFunction(async () => {
  try {
    await countdown(
      3,
      async () => {
        const result = await checkLimitOrderCriteria();
        if (!result) {
          logger.info('[limitOrderCriteriaChecker] none of the `limit` orders met the criteria');
        } else {
          logger.info('[limitOrderCriteriaChecker] trade criteria met:', result);
        }
      },
      3_000,
    );
  } catch (e: unknown) {
    handleError(e);
  }
});
