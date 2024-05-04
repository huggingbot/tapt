// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { Token } from 'npm:@uniswap/sdk-core@^3.2.3';
import { computePoolAddress, FeeAmount } from 'npm:@uniswap/v3-sdk@3.11.0';
import { ethers } from 'npm:ethers@^5.7.2';

import IUniswapV3PoolABI from '../contracts/UniswapV3Pool.json' with { type: 'json' };
import QuoterABI from '../contracts/UniswapV3Quote.json' with { type: 'json' };
import { ETH_UNISWAP_V3_FACTORY_ADDRESS, TAPT_BACKEND_API_URL } from '../utils/config.ts';
import { ETH_UNISWAP_V3_QUOTER_ADDRESS } from '../utils/config.ts';
import { ENetwork, EOrderStatus } from '../utils/constants.ts';
import { getProvider } from '../utils/helpers.ts';
import { ApiResponse, ILimitOrder } from '../utils/types.ts';

const ResponseHeaders = { headers: { 'Content-Type': 'application/json' } };

Deno.serve(async () => {
  const resp = await fetch(`${TAPT_BACKEND_API_URL}/orders/limit?orderStatus=${EOrderStatus.READY_TO_PROCESS}`);
  const respJson: ApiResponse<ILimitOrder[]> = await resp.json();

  if (!respJson.success || !respJson.data) {
    return new Response(JSON.stringify({ error: respJson.error || 'error calling API' }), ResponseHeaders);
  }

  const orders = respJson.data;
  const provider = getProvider(ENetwork.Local);
  const ordersToBePrcessed: number[] = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const { id, buyToken, sellToken, buyAmount, sellAmount } = order;

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
    if (amountIn >= buyAmount) {
      // send for approval
      console.log(`Limit order condition met for order with id, ${id}`);
      ordersToBePrcessed.push(id);
    }
  }

  if (ordersToBePrcessed.length > 0) {
    // bulk update orders
    await fetch(`${TAPT_BACKEND_API_URL}/orders/bulk_update_status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        setdata: { orderStatus: EOrderStatus.READY_TO_PROCESS },
        idsToUpdate: ordersToBePrcessed,
      }),
    });
  }

  return new Response(JSON.stringify(orders), ResponseHeaders);
});
