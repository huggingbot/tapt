import { Token } from '@uniswap/sdk-core';
import { SwapRoute } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import log from 'loglevel';
import { Telegraf } from 'telegraf';

import { db } from '@/database/db';
import { getOrderDetailsById, updateOrderById } from '@/database/queries/order';
import { createTransaction } from '@/database/queries/transaction';
import { getUserByUserId } from '@/database/queries/user';
import { ENetwork } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { fromChainIdToNetwork } from '@/libs/conversion';
import { composeOrderNotificationText } from '@/libs/notifications';
import { getProvider } from '@/libs/providers';
import { executeRoute, generateRoute } from '@/libs/routing';
import { unwrapNativeToken, wrapNativeToken } from '@/libs/wallet';
import { EOrderStatus, ETransactionStatus, ETransactionType, IToken } from '@/types';
import { decryptPrivateKey } from '@/utils/crypto';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Telegram bot token is missing');
}
const app = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

export async function executeLimitTrades(req: Request, res: Response) {
  try {
    const order = await getOrderDetailsById(req.params.orderId as unknown as number);
    if (!order) {
      return res.status(400).json({ success: false, message: `Order not found with id, ${req.params.orderId}` });
    }

    // additional params which will be shared between promises iterations
    const additionalParams: {
      orderId: number;
      wallet: ethers.Wallet;
      network: ENetwork;
      route?: SwapRoute;
      orderMode: string;
      sellToken: IToken;
      buyToken: IToken;
      sellAmount: string;
      userId: number;
    }[] = [];

    const { orderId, sellAmount, sellToken, buyToken, encryptedPrivateKey, chainId, orderMode, userId } = order;

    if (!sellToken || !buyToken) {
      return res.status(400).json({ success: false, message: 'BuyToken and SellToken not found!' });
    }

    const network = fromChainIdToNetwork(chainId);
    const provider = getProvider(ENetwork.Local);
    const privateKey = decryptPrivateKey(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    additionalParams.push({ orderId, wallet, network, sellToken, buyToken, sellAmount, userId, orderMode: orderMode || 'buy' });

    if (orderMode === 'buy') {
      await wrapNativeToken(wallet, network, Number(sellAmount));
    }

    const tokenOut = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
    const tokenIn = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

    let route: SwapRoute | null = null;
    if (orderMode === 'buy') {
      route = await generateRoute(wallet, network, { tokenIn: WRAPPED_NATIVE_TOKEN[network], tokenOut, amount: Number(sellAmount) });
    } else {
      route = await generateRoute(wallet, network, { tokenIn, tokenOut: WRAPPED_NATIVE_TOKEN[network], amount: Number(sellAmount) });
    }

    if (!route) {
      throw new Error('fail to generate route');
    }

    // executing routes
    const routeExecResponse = await executeRoute(wallet, network, route);
    let txnHash: string | undefined;
    let telegramId: string = '';
    if (typeof routeExecResponse === 'object') {
      if (orderMode === 'sell') {
        await unwrapNativeToken(wallet, network, Number(route.quote.toExact()));
      }
      await db.transaction().execute(async (trx) => {
        // update order
        await updateOrderById(
          orderId,
          {
            orderStatus: EOrderStatus.ExecutionPending,
            buyAmount: Number(route.quote.toExact()),
          },
          trx,
        );

        // create new txn to track
        await createTransaction(
          {
            orderId,
            walletId: order.walletId,
            transactionHash: routeExecResponse.hash,
            toAddress: routeExecResponse.to,
            transactionType: ETransactionType.Withdraw,
            transactionStatus: ETransactionStatus.Pending,
          },
          trx,
        );
        txnHash = routeExecResponse.hash;

        const user = await getUserByUserId(userId);
        if (!user) {
          throw new Error(`user not found with id, ${userId}`);
        }
        telegramId = user.telegramId;
      });
    } else {
      // failed to execute the trade
      // we're not gonna do anything here
      // instead, we will retry and let the next cron execution to do again
    }

    const message = composeOrderNotificationText(
      {
        ...order,
        buyToken,
        sellToken,
        buyAmount: route ? route.quote.toExact() : undefined,
        orderStatus: EOrderStatus.ExecutionPending,
      },
      txnHash,
    );

    const msg = await app.telegram.sendMessage(telegramId, message);
    return res.status(200).json({ success: true, data: msg });
  } catch (e: unknown) {
    log.error(`Error exeucting trade: ${(e as Error).message}`);
    return undefined;
  }
}
