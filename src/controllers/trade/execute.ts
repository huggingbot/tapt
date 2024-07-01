import { Token } from '@uniswap/sdk-core';
import { SwapRoute } from '@uniswap/smart-order-router';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { object } from 'joi';
import log from 'loglevel';
import { Telegraf } from 'telegraf';

import { db } from '@/database/db';
import { getOrdersByIds, updateOrderById } from '@/database/queries/order';
import { createTransaction } from '@/database/queries/transaction';
import { getUserByUserId } from '@/database/queries/user';
import { ENetwork } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { fromChainIdToNetwork } from '@/libs/conversion';
import { composeOrderNotificationText } from '@/libs/notifications';
import { getProvider } from '@/libs/providers';
import { executeRoute, generateRoute } from '@/libs/routing';
import { unwrapNativeToken, wrapNativeToken } from '@/libs/wallet';
import { EOrderStatus, ETransactionStatus, ETransactionType, ILimitOrder } from '@/types';
import { decryptPrivateKey } from '@/utils/crypto';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Telegram bot token is missing');
}
const app = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

type ILimitOrderDetails = ILimitOrder & { userId: number };

async function updateLimitOrders(order: ILimitOrderDetails, txnResponse: ethers.providers.TransactionResponse, buyAmount: number) {
  const { orderId, userId } = order;
  return db.transaction().execute(async (trx) => {
    // update order
    await updateOrderById(
      orderId,
      {
        orderStatus: EOrderStatus.ExecutionPending,
        buyAmount,
      },
      trx,
    );

    // create new txn to track
    await createTransaction(
      {
        orderId,
        walletId: order.walletId,
        transactionHash: txnResponse.hash,
        toAddress: txnResponse.to,
        transactionType: ETransactionType.Withdraw,
        transactionStatus: ETransactionStatus.Pending,
      },
      trx,
    );

    const user = await getUserByUserId(userId);
    if (!user) {
      throw new Error(`user not found with id, ${userId}`);
    }

    return {
      txnHash: txnResponse.hash,
      telegramId: user.telegramId,
    };
  });
}

export async function executeLimitTrades(req: Request, res: Response) {
  try {
    const { orderIds } = req.body as { orderIds: number[] };

    const orders = await getOrdersByIds(orderIds);

    // additional params which will be shared between promises iterations
    const additionalParams: {
      wallet: ethers.Wallet;
      network: ENetwork;
      route?: SwapRoute;
      txnResponse?: ethers.providers.TransactionResponse;
      order: ILimitOrder & { userId: number };
    }[] = [];

    const tokenWrappedResults = await Promise.allSettled(
      orders.map((order) => {
        const { encryptedPrivateKey, chainId, orderMode, sellAmount } = order as ILimitOrder & { userId: number };

        const network = fromChainIdToNetwork(chainId);
        const provider = getProvider(ENetwork.Local);
        const privateKey = decryptPrivateKey(encryptedPrivateKey);
        const wallet = new ethers.Wallet(privateKey, provider);

        additionalParams.push({ order: order as ILimitOrder & { userId: number }, wallet, network });

        if (orderMode === 'buy') {
          // In the 'buy' mode, we are buying 'X' token with Native ETH
          // In order to do the trade (swap), we need to convert ETH to WETH
          // so here, we're wrapping the ETH to convert to WETH
          return wrapNativeToken(wallet, network, Number(sellAmount));
        }
        return undefined;
      }),
    );

    // generate routes
    const routeGenResults = await Promise.allSettled(
      tokenWrappedResults.map((result, idx) => {
        if (result.status === 'rejected') {
          return undefined;
        }

        const { order, wallet, network } = additionalParams[idx];
        const { buyToken, sellToken, orderMode, sellAmount } = order;
        if (!buyToken || !sellToken) {
          return undefined;
        }

        const tokenOut = new Token(buyToken.chainId, buyToken.contractAddress, buyToken.decimalPlaces, buyToken.symbol);
        const tokenIn = new Token(sellToken.chainId, sellToken.contractAddress, sellToken.decimalPlaces, sellToken.symbol);

        if (orderMode === 'buy') {
          return generateRoute(wallet, network, { tokenIn: WRAPPED_NATIVE_TOKEN[network], tokenOut, amount: Number(sellAmount) });
        } else {
          return generateRoute(wallet, network, { tokenIn, tokenOut: WRAPPED_NATIVE_TOKEN[network], amount: Number(sellAmount) });
        }
      }),
    );

    // execute routes
    const routeExecResults = await Promise.allSettled(
      routeGenResults.map((result, idx) => {
        if (result.status === 'rejected' || !result.value) {
          return undefined;
        }

        const { wallet, network } = additionalParams[idx];
        additionalParams[idx] = {
          ...additionalParams[idx],
          route: result.value,
        };

        return executeRoute(wallet, network, result.value);
      }),
    );

    // unwrapped native tokens for 'sell' orders
    const unwrappedResults = await Promise.allSettled(
      routeExecResults.map((result, idx) => {
        if (result.status === 'rejected' || !result.value) {
          throw new Error('Error executing route'); // reject
        }
        const { order, route, wallet, network } = additionalParams[idx];
        if (!route) {
          throw new Error('Route not found!'); // reject promise
        }

        if (typeof result.value === 'object') {
          additionalParams[idx] = {
            ...additionalParams[idx],
            txnResponse: result.value,
          };
        } else {
          // route execution failed
          // we're not doing anything here,
          // this will be retried in next cron iteration
          throw new Error('Route exeuction failed');
        }

        if (order.orderMode === 'sell') {
          return unwrapNativeToken(wallet, network, Number(route.quote.toExact()));
        }
        return result.value;
      }),
    );

    // update database
    const updateOrderResults = await Promise.allSettled(
      unwrappedResults.map((result, idx) => {
        if (result.status === 'rejected' || !result.value) {
          // if route gen/exec failed, we're gonna retry in the next iteration
          return undefined;
        }

        const { order, txnResponse, route } = additionalParams[idx];

        let transactionResponse = txnResponse;
        if (!transactionResponse && result.value instanceof object) {
          transactionResponse = result.value;
        }
        if (!transactionResponse || !route) {
          throw new Error('Route execution failed');
        }

        return updateLimitOrders(order, transactionResponse, Number(route.quote.toExact()));
      }),
    );

    const notificationResults = await Promise.allSettled(
      updateOrderResults.map((result, idx) => {
        if (result.status === 'rejected' || !result.value) {
          return undefined;
        }
        const { order, route } = additionalParams[idx];
        const { txnHash, telegramId } = result.value;

        const message = composeOrderNotificationText(
          {
            ...order,
            buyAmount: route ? route.quote.toExact() : undefined,
            orderStatus: EOrderStatus.ExecutionPending,
          },
          txnHash,
        );

        return app.telegram.sendMessage(telegramId, message);
      }),
    );

    const numOfNotiSent = notificationResults.filter((r) => r.status === 'fulfilled').length;

    return res.status(200).json({ success: true, data: `Total ${numOfNotiSent} notifications sent` });
  } catch (e: unknown) {
    log.error(`Error exeucting trade: ${(e as Error).message}`);
    return undefined;
  }
}
