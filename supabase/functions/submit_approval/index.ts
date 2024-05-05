/**
 * This function is responsible to get approval from wallet for uniswap usage
 * This is first function (cron) in the order processing crons
 */

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { AlphaRouter, CurrencyAmount, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router';
import { Percent, Token, TradeType } from 'npm:@uniswap/sdk-core@3.2.6';
// import { AlphaRouter, CurrencyAmount, SwapOptionsSwapRouter02, SwapType } from "npm:@uniswap/smart-order-router@3.0.6";
import { ethers } from 'npm:ethers@^5.7.2';

import { ETH_UNISWAP_V3_SWAP_ROUTER_ADDRESS, TAPT_BACKEND_API_URL } from '../utils/config.ts';
import { ENetwork, EOrderStatus, ERC20_ABI } from '../utils/constants.ts';
import { decryptPrivateKey } from '../utils/crypto.ts';
import { fromReadableAmount, getProvider, sendTransaction } from '../utils/helpers.ts';
import { ApiResponse, ILimitOrder, TransactionState } from '../utils/types.ts';

const ResponseHeaders = { headers: { 'Content-Type': 'application/json' } };

Deno.serve(async () => {
  // fetching orders which are ready to be approve txn
  console.log('url', `${TAPT_BACKEND_API_URL}/orders/limit?orderStatus=${EOrderStatus.SUBMITTED}`);
  const resp = await fetch(`${TAPT_BACKEND_API_URL}/orders/limit?orderStatus=${EOrderStatus.SUBMITTED}`);
  const respJson: ApiResponse<ILimitOrder[]> = await resp.json();

  if (!respJson.success || !respJson.data) {
    return new Response(JSON.stringify({ error: respJson.error || 'error calling API' }), ResponseHeaders);
  }

  const orders = respJson.data;
  const provider = getProvider(ENetwork.Local);

  for (let i = 0; i < orders.length; i++) {
    const { buyToken, buyAmount, sellToken, basicWallet } = orders[i];

    const tokenIn = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenOut = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    const router = new AlphaRouter({ chainId: buyToken.chainId, provider });

    const options: SwapOptionsSwapRouter02 = {
      recipient: basicWallet.wallet_address,
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    };

    const rawTokenAmountIn = fromReadableAmount(Number(buyAmount), tokenIn.decimals);
    const route = await router.route(CurrencyAmount.fromRawAmount(tokenIn, rawTokenAmountIn.toString()), tokenOut, TradeType.EXACT_INPUT, options);

    if (route && route.methodParameters) {
      const privateKey = decryptPrivateKey(basicWallet.encryted_private_key);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, wallet);
      const transaction = await tokenContract.populateTransaction.approve(
        ETH_UNISWAP_V3_SWAP_ROUTER_ADDRESS,
        ethers.BigNumber.from(rawTokenAmountIn.toString()),
      );
      const res = await sendTransaction(wallet, ENetwork.Local, transaction);
      if (res === TransactionState.Failed) {
        console.error('approval transaction failed');
      } else {
        const txn = res as ethers.providers.TransactionResponse;
        console.log('approval txn hash', txn.hash);
        console.log('approval block hash', txn.blockHash);
      }
    }
  }

  return new Response(JSON.stringify({ message: 'OK!' }), ResponseHeaders);
});
