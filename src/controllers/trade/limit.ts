import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import QuoterABI from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { Telegraf } from 'telegraf';

import { db } from '@/database/db';
import { getOrdersByIds, updateOrderById } from '@/database/queries/order';
import { getUserByUserId } from '@/database/queries/user';
import { ENetwork } from '@/libs/config';
import { UNISWAP_QUOTER_ADDRESS, V3_UNISWAP_FACTORY_ADDRESS } from '@/libs/constants';
import { fromChainIdToNetwork } from '@/libs/conversion';
import { composeOrderNotificationText } from '@/libs/notifications';
import { getProvider } from '@/libs/providers';
import { EOrderStatus, ILimitOrder } from '@/types';
import { decryptPrivateKey } from '@/utils/crypto';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Telegram bot token is missing');
}
const app = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

export function isLimitOrderCriteriaMet(orderMode: string, amountIn: number, targetPrice: number): boolean {
  return (orderMode === 'buy' && amountIn <= targetPrice) || (orderMode === 'sell' && amountIn >= targetPrice);
}

async function updateLimitOrderDetails(orderId: number, userId: number) {
  return await db.transaction().execute(async (trx) => {
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
    return user.telegramId;
  });
}

export async function checkLimitOrderCriteria(req: Request, res: Response) {
  const { orderIds } = req.body as { orderIds: number[] };

  const orders = await getOrdersByIds(orderIds);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    order: ILimitOrder & { userId: number };
    tokenInput: Token;
    tokenOutput: Token;
    network: ENetwork;
    wallet: ethers.Wallet;
  }[] = [];

  const tokenDetailsResults = await Promise.allSettled(
    orders.map((order) => {
      const { buyToken, sellToken, chainId, encryptedPrivateKey } = order as ILimitOrder & { userId: number };

      if (!buyToken || !sellToken) {
        return undefined;
      }

      const network = fromChainIdToNetwork(chainId);
      const provider = getProvider(network);
      const tokenOutput = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
      const tokenInput = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);
      const privateKey = decryptPrivateKey(encryptedPrivateKey);
      const wallet = new ethers.Wallet(privateKey, provider);

      const currentPoolAddress = computePoolAddress({
        factoryAddress: V3_UNISWAP_FACTORY_ADDRESS[network],
        tokenA: tokenOutput,
        tokenB: tokenInput,
        fee: FeeAmount.MEDIUM,
      });

      additionalParams.push({
        order: order as ILimitOrder & { userId: number },
        tokenInput,
        tokenOutput,
        network,
        wallet,
      });

      const poolContract = new ethers.Contract(currentPoolAddress, IUniswapV3PoolABI.abi, provider);
      return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee(), poolContract.liquidity(), poolContract.slot0()]);
    }),
  );

  // get quoted price
  const quotedPriceResults = await Promise.allSettled(
    tokenDetailsResults.map((result, idx) => {
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
    }),
  );

  const updateOrderResults = await Promise.allSettled(
    quotedPriceResults.map((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const { tokenOutput, tokenInput, order } = additionalParams[idx];
        const { orderMode, orderId, userId, targetPrice } = order;

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

        // check whether the current market price satisfies Limit order criteria
        if (isLimitOrderCriteriaMet(orderMode || 'buy', Number(amountOut), targetPrice)) {
          console.log(`Limit order condition met for order with id, ${orderId}`);
          return updateLimitOrderDetails(orderId, userId);
        }
      }
      return undefined;
    }),
  );

  // send notifications
  const notificationResults = await Promise.allSettled(
    updateOrderResults.map((result, idx) => {
      if (result.status === 'rejected' || !result.value) {
        return undefined;
      }
      const { order } = additionalParams[idx];

      const message = composeOrderNotificationText({
        ...order,
        orderStatus: EOrderStatus.ExecutionReady,
      });

      return app.telegram.sendMessage(result.value, message);
    }),
  );

  const numOfNotiSent = notificationResults.filter((r) => r.status === 'fulfilled').length;

  return res.status(200).json({ success: true, data: `Total ${numOfNotiSent} notifications sent` });
}
