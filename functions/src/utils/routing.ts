/* eslint-disable max-len */
import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core';
import { SwapRoute, AlphaRouter, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router';
import { Wallet, ethers } from 'ethers';
import { AppConfig, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS, TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER, V3_UNISWAP_ROUTER_ADDRESS } from './constants';
import { fromReadableAmount } from './helpers';
import { getProvider } from './providers';
import { ENetwork, TransactionState } from './types';
import { sendTransactionViaWallet } from './transactions';
import { getErc20Contract } from './constracts';

interface IGenerateRouteParams {
  tokenIn: Token;
  tokenOut: Token;
  amount: number;
  slippage?: number;
}

/**
 * Generate routes for swapping ERC20 tokens
 * @param {Wallet} wallet
 * @param {ENetwork} network
 * @param {IGenerateRouteParams} args
 * @return {SwapRouter | null} generated swap router
 */
export async function generateRoute(wallet: Wallet, network: ENetwork, args: IGenerateRouteParams): Promise<SwapRoute | null> {
  const router = new AlphaRouter({
    chainId: AppConfig[network].chainId,
    provider: getProvider(network),
  });

  const options: SwapOptionsSwapRouter02 = {
    recipient: wallet.address,
    slippageTolerance: new Percent(args.slippage || 50, 10_000),
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.SWAP_ROUTER_02,
  };

  const route = await router.route(
    CurrencyAmount.fromRawAmount(args.tokenIn, fromReadableAmount(args.amount, args.tokenIn.decimals).toString()),
    args.tokenOut,
    TradeType.EXACT_INPUT,
    options,
    { maxSwapsPerPath: 1 },
  );

  return route;
}

/**
 * Execute swap with generated SwapRoute
 * @param {Wallet} wallet
 * @param {ENetwork} network
 * @param {SwapRoute} route
 * @return {ethers.providers.TransactionResponse | TransactionState} result from sending transaction
 */
export async function executeRoute(
  wallet: Wallet,
  network: ENetwork,
  route: SwapRoute,
): Promise<ethers.providers.TransactionResponse | TransactionState> {
  const inputToken = route.trade.inputAmount.currency;
  if (!inputToken.isToken) {
    throw new Error('Input currency must be a token');
  }
  const tokenApproval = await getTokenTransferApproval(wallet, network, inputToken);

  // Fail if transfer approvals do not go through
  if (typeof tokenApproval === 'string' && tokenApproval !== TransactionState.Sent) {
    return TransactionState.Failed;
  }

  const res = await sendTransactionViaWallet(wallet, network, {
    data: route.methodParameters?.calldata,
    to: V3_UNISWAP_ROUTER_ADDRESS[network],
    value: route?.methodParameters?.value,
    from: wallet.address,
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
  });

  return res;
}

/**
 * Get approval for Token Transfer
 * @param {Wallet} wallet
 * @param {ENetwork} network
 * @param {Token} token
 * @return {ethers.providers.TransactionResponse | TransactionState} result from sending transaction
 */
export async function getTokenTransferApproval(
  wallet: Wallet,
  network: ENetwork,
  token: Token,
): Promise<ethers.providers.TransactionResponse | TransactionState> {
  const provider = getProvider(network);

  try {
    const tokenContract = getErc20Contract(token.address, provider);

    const transaction = await tokenContract.populateTransaction.approve(
      V3_UNISWAP_ROUTER_ADDRESS[network],
      fromReadableAmount(TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER, token.decimals).toString(),
    );

    return sendTransactionViaWallet(wallet, network, {
      ...transaction,
      from: wallet.address,
    });
  } catch (e) {
    console.error(e);
    return TransactionState.Failed;
  }
}
