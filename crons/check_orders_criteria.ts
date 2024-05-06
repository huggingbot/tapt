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
import { getProvider } from '../src/libs/providers';
import { EOrderStatus, ETH_UNISWAP_V3_FACTORY_ADDRESS, ETH_UNISWAP_V3_QUOTER_ADDRESS, TAPT_API_ENDPOINT } from './utils/constants';
import { ApiResponse, ILimitOrder } from './utils/types';

export async function run() {
  const resp = await fetch(`${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.ApprovalCompleted}`);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;

  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;
  const ordersToBePrcessed: number[] = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const { id, buyToken, sellToken, targetPrice, sellAmount } = order;
    const provider = getProvider(ENetwork.Local);
    const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    const currentPoolAddress = computePoolAddress({
      factoryAddress: ETH_UNISWAP_V3_FACTORY_ADDRESS,
      tokenA: tokenOutput,
      tokenB: tokenInput,
      fee: FeeAmount.MEDIUM,
    });
    console.log('currentPoolAddress', currentPoolAddress);

    const quoterContract = new ethers.Contract(ETH_UNISWAP_V3_QUOTER_ADDRESS, QuoterABI.abi, provider);

    const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
    // const immutables = await getPoolImmutables(poolContract);
    const [token0, token1, fee] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    const amountOut = ethers.utils.parseUnits(sellAmount, tokenInput.decimals);
    const quotedAmountIn = await quoterContract.callStatic.quoteExactOutputSingle(token0, token1, fee, amountOut, 0);

    const amountIn = ethers.utils.formatUnits(quotedAmountIn, tokenOutput.decimals);
    console.log('=====================');
    console.log(`${sellAmount} ${tokenInput.symbol} can be swapped for ${amountIn} ${tokenOutput.symbol}`);
    console.log('=====================');
    if (Number(amountIn) >= targetPrice) {
      // send for approval
      console.log(`Limit order condition met for order with id, ${id}`);
      ordersToBePrcessed.push(id);
    }
  }

  if (ordersToBePrcessed.length > 0) {
    // bulk update orders
    await fetch(`${TAPT_API_ENDPOINT}/orders/bulk_update_status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        setdata: { orderStatus: EOrderStatus.ExecutionReady },
        idsToUpdate: ordersToBePrcessed,
      }),
    });
  }
}
