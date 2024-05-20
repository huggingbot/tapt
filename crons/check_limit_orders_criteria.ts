/**
 * This function is responsible for checking the trading criteria in current market based on the order placed
 * If the trading criteria has met, then it will update the backend and db, so that the next function in line can execute the orders
 * In trading crons workflow, we can list this trade as cron number 2
 * For e.g:
 *    limit order: [submit_approval] -> [track_txn] -> **[check_orders_criteria]** -> [execute_trade] -> [track_txn] -> (DONE)
 */
import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';

import { ENetwork } from '../src/libs/config';
import { UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '../src/libs/constants';
import { getProvider } from '../src/libs/providers';
import { EOrderStatus, TAPT_API_ENDPOINT } from './utils/constants';
import { ApiResponse, ILimitOrder, LimitOrderMode } from './utils/types';

export function isLimitOrderCriteriaMet(orderMode: LimitOrderMode, amountIn: number, targetPrice: number): boolean {
  console.log('orderMode', orderMode);
  return (orderMode === 'buy' && amountIn <= targetPrice) || (orderMode === 'sell' && amountIn >= targetPrice);
}

export async function checkLimitOrderCriteria() {
  const resp = await fetch(`${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ApprovalCompleted}`);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;

  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;
  const ordersToBePrcessed: number[] = [];
  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    targetPrice: number;
    sellAmount: string;
    tokenInput: Token;
    tokenOutput: Token;
    orderMode: LimitOrderMode;
  }[] = [];
  // compute TokenPool Addr and get Tokens Details
  const tokensDetailsPromise = orders.map((order) => {
    const { orderId, buyToken, sellToken, targetPrice, sellAmount, orderMode } = order;
    const provider = getProvider(ENetwork.Local);
    const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    const currentPoolAddress = computePoolAddress({
      factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[ENetwork.Local],
      tokenA: tokenOutput,
      tokenB: tokenInput,
      fee: FeeAmount.MEDIUM,
    });
    console.log('currentPoolAddress', currentPoolAddress);

    additionalParams.push({ orderId, targetPrice, sellAmount, tokenOutput, tokenInput, orderMode });

    const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
    return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
  });
  const tokenDetailsResult = await Promise.allSettled(tokensDetailsPromise);

  // Quote current market price for Target Token
  const quotedAmountsPromises = tokenDetailsResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    const provider = getProvider(ENetwork.Local);
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[ENetwork.Local], QuoterABI.abi, provider);
    const { sellAmount, tokenInput } = additionalParams[idx];

    const [token0, token1, fee] = result.value;
    const amountIn = ethers.utils.parseUnits('1', tokenInput.decimals);
    return quoterContract.callStatic.quoteExactOutputSingle(token0, token1, fee, amountIn, 0);
  });
  const quotedAmountResults = await Promise.allSettled(quotedAmountsPromises);

  // Validate and check LIMIT_ORDER crtieria
  quotedAmountResults.forEach((result, idx) => {
    const { tokenOutput, sellAmount, tokenInput, orderId, targetPrice, orderMode } = additionalParams[idx];
    if (result.status === 'fulfilled' && result.value) {
      const amountOut = ethers.utils.formatUnits(result.value, tokenOutput.decimals);
      console.log('=====================');
      console.log(`Target Price: ${targetPrice}`);
      console.log(`${sellAmount} ${tokenInput.symbol} can be swapped for ${amountOut} ${tokenOutput.symbol}`);
      console.log('=====================');

      if (isLimitOrderCriteriaMet(orderMode, Number(amountOut), targetPrice)) {
        // send for approval
        console.log(`Limit order condition met for order with id, ${orderId}`);
        ordersToBePrcessed.push(orderId);
      }
    }
  });

  if (ordersToBePrcessed.length > 0) {
    // bulk update orders
    const body = {
      setdata: { orderStatus: EOrderStatus.ExecutionReady },
      idsToUpdate: ordersToBePrcessed,
    };
    console.log('body', body);
    const resp = await fetch(`${TAPT_API_ENDPOINT}/orders/bulk_update_status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    console.log('resp', await resp.json());
  }
}

(async function () {
  await checkLimitOrderCriteria();
})();
