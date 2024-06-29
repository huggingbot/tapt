import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { Telegraf } from 'telegraf';

import { db } from '@/database/db';
import { getOrderDetailsById, updateOrderById } from '@/database/queries/order';
import { getUserByUserId } from '@/database/queries/user';
import { UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '@/libs/constants';
import { fromChainIdToNetwork } from '@/libs/conversion';
import { composeOrderNotificationText } from '@/libs/notifications';
import { getProvider } from '@/libs/providers';
import { EOrderStatus, EOrderType, ILimitOrder } from '@/types';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Telegram bot token is missing');
}
const app = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

export function isLimitOrderCriteriaMet(orderMode: string, amountIn: number, targetPrice: number): boolean {
  return (orderMode === 'buy' && amountIn <= targetPrice) || (orderMode === 'sell' && amountIn >= targetPrice);
}

export async function checkLimitOrderCriteria(req: Request, res: Response) {
  const order = await getOrderDetailsById(req.params.orderId as unknown as number);
  if (!order) {
    return res.status(400).json({ success: false, message: `Order not found with id, ${req.params.orderId}` });
  }
  if (order.orderType !== String(EOrderType.Limit)) {
    return res.status(400).json({ success: false, message: `Order with id, ${req.params.orderId} is not LIMIT order!` });
  }

  const start = Date.now();
  // compute TokenPool Addr and get Tokens Details
  const { buyToken, sellToken, chainId, orderId, targetPrice, orderMode, userId } = order as unknown as ILimitOrder & { userId: number };
  if (!buyToken || !sellToken) {
    return res.status(400).json({ success: false, message: 'BuyToken and SellToken not found!' });
  }

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

  const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  // Quote current market price for Target Token
  const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS[network], QuoterABI.abi, provider);

  const decimals0 = order.orderMode === 'buy' ? tokenOutput.decimals : tokenInput.decimals;
  const amountIn = ethers.utils.parseUnits('1', decimals0);
  const quotedAmount = await quoterContract.callStatic.quoteExactInputSingle(token0, token1, fee, amountIn, 0);

  console.log('quotedAmount', quotedAmount);

  // Validate and check LIMIT_ORDER crtieria
  const baseSymbol = orderMode === 'buy' ? tokenInput.symbol : tokenOutput.symbol;
  const targetSymbol = orderMode === 'buy' ? tokenOutput.symbol : tokenInput.symbol;
  const decimals1 = orderMode === 'buy' ? tokenInput.decimals : tokenOutput.decimals;
  const amountOut = ethers.utils.formatUnits(quotedAmount, decimals1);
  console.log('=====================');
  console.log(`Target Price: ${targetPrice}`);
  console.log(`1 ${baseSymbol} can be swapped for ${amountOut} ${targetSymbol}`);
  console.log('=====================');

  if (isLimitOrderCriteriaMet(orderMode || 'buy', Number(amountOut), targetPrice)) {
    // send for approval
    console.log(`Limit order condition met for order with id, ${orderId}`);

    let telegramId = '';
    await db.transaction().execute(async (trx) => {
      const updatedOrder = await updateOrderById(
        orderId,
        {
          orderStatus: EOrderStatus.ExecutionReady,
        },
        trx,
      );
      console.log('updatedOrder', updatedOrder);

      const user = await getUserByUserId(userId, trx);
      if (!user) {
        throw new Error(`user not found with id, ${userId}`);
      }
      telegramId = user.telegramId;
    });
    console.log(`Checking Limit Orders Criteria takes ${Date.now() - start} ms to complete!`);

    // send notifications
    const message = composeOrderNotificationText({
      ...order,
      buyToken,
      sellToken,
      orderStatus: EOrderStatus.ExecutionReady,
    });

    const msg = await app.telegram.sendMessage(telegramId, message);
    return res.status(200).json({ success: true, data: msg });
  }

  return res.status(200).json({ success: true, data: 'None of the orders mets criteria' });
}
