import parse from 'postgres-interval';

import { V3_UNISWAP_ROUTER_ADDRESS } from '@/libs/constants';
import { EOrderStatus, EOrderType, ETransactionStatus, ETransactionType, IBasicWallet } from '@/types';
import { isNumber } from '@/utils/common';

import { db } from '../db';
import { Interval } from '../gen-types';
import {
  createOrder,
  ELimitOrderMode,
  getOrderById,
  getOrders,
  GetOrdersFilters,
  ICreateDcaOrderParams,
  ICreateLimitOrderParams,
  ICreateOrderParams,
  updateOrderById,
} from './order';
import { createTokens, ICreateTokenParams } from './token';
import { createTransaction, ICreateTransactionParams } from './transaction';
import { getWallet } from './wallet';

interface IPlaceSwapOrderParams {
  tokenIn: ICreateTokenParams;
  tokenOut: ICreateTokenParams;
  orderParam: Pick<ICreateOrderParams, 'buyAmount' | 'sellAmount'>;
  transactionParam: Pick<ICreateTransactionParams, 'transactionHash'>;
}

export const placeSwapOrder = async (basicWallet: IBasicWallet, params: IPlaceSwapOrderParams) => {
  const { tokenIn, tokenOut, orderParam, transactionParam } = params;

  return await db.transaction().execute(async (trx) => {
    const wallet = await getWallet(basicWallet, trx);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    const tokens = await createTokens([tokenIn, tokenOut], trx);
    if (tokens.length !== 2) {
      throw new Error('Failed to create tokens');
    }
    const [inputToken, outputToken] = tokens;

    const completeOrderParam: ICreateOrderParams = {
      ...orderParam,
      walletId: wallet.id,
      buyTokenId: inputToken.id,
      sellTokenId: outputToken.id,
      orderType: EOrderType.Market,
      orderStatus: EOrderStatus.Completed,
      orderMode: null,
    };
    const order = await createOrder(completeOrderParam, trx);
    if (!order) {
      throw new Error('Failed to create order');
    }
    // const transaction = await createTransaction(transactionParam, trx);
    const transaction = await createTransaction(
      {
        walletId: wallet.id,
        orderId: order.id,
        toAddress: V3_UNISWAP_ROUTER_ADDRESS[basicWallet.network],
        transactionHash: transactionParam.transactionHash,
        transactionType: ETransactionType.Swap,
        transactionStatus: ETransactionStatus.Pending,
      },
      trx,
    );
    if (!transaction) {
      throw new Error('Failed to create transaction');
    }
    return { wallet, order, transaction };
  });
};

export const placeLimitOrder = async (params: {
  tokenToSell: ICreateTokenParams; // sell token
  tokenToBuy: ICreateTokenParams; // buy token
  wallet: IBasicWallet;
  tradeParam: {
    buyAmount: number;
    sellAmount: number;
    targetPrice: string;
    expirationDate?: string;
    orderMode: ELimitOrderMode;
  };
}) => {
  const { tokenToSell, tokenToBuy, wallet, tradeParam } = params;
  const { buyAmount, sellAmount, targetPrice, expirationDate, orderMode } = tradeParam;
  if (!isNumber(targetPrice)) {
    throw new Error('invalid target price');
  }

  return await db.transaction().execute(async (txn) => {
    // wallet valiation
    const w = await getWallet(wallet, txn);
    if (!w) {
      throw new Error('Wallet not found');
    }

    const tokens = await createTokens([tokenToSell, tokenToBuy], txn);
    if (tokens.length !== 2) {
      throw new Error('Failed to create tokens');
    }
    // in below, we need to re:find the correct token from the `tokens array` we got from `createTokens` func
    // since `createTokens` func doesn't preserve the input orders, we can't do list destructuring
    const buyToken = tokens.find((token) => token.contractAddress === tokenToBuy.contractAddress);
    const sellToken = tokens.find((token) => token.contractAddress === tokenToSell.contractAddress);
    if (!buyToken || !sellToken) {
      throw new Error('Failed to get tokens');
    }

    const newOrder: ICreateLimitOrderParams = {
      orderType: EOrderType.Limit,
      orderStatus: EOrderStatus.Submitted,
      walletId: w.id,
      buyTokenId: buyToken.id,
      sellTokenId: sellToken.id,
      targetPrice: Number(tradeParam.targetPrice),
      buyAmount,
      sellAmount,
      expirationDate,
      orderMode,
    };
    const order = await createOrder(newOrder, txn);
    if (!order) {
      throw new Error('failed to create order');
    }

    return { wallet: w, order };
  });
};

export const placeDcaOrder = async (params: {
  tokenToSell: ICreateTokenParams; // sell token
  tokenToBuy: ICreateTokenParams; // buy token
  wallet: IBasicWallet;
  tradeParam: {
    buyAmount: number;
    sellAmount: number;
    maxPrice: number;
    minPrice: number;
    interval: number;
    duration: number;
    orderMode: ELimitOrderMode;
  };
}) => {
  const { tokenToSell, tokenToBuy, wallet, tradeParam } = params;

  return await db.transaction().execute(async (txn) => {
    const w = await getWallet(wallet, txn);
    if (!w) {
      throw new Error('Wallet not found');
    }

    const tokens = await createTokens([tokenToSell, tokenToBuy], txn);
    if (tokens.length !== 2) {
      throw new Error('Failed to create tokens');
    }
    // in below, we need to re:find the correct token from the `tokens array` we got from `createTokens` func
    // since `createTokens` func doesn't preserve the input orders, we can't do list destructuring
    const buyToken = tokens.find((token) => token.contractAddress === tokenToBuy.contractAddress);
    const sellToken = tokens.find((token) => token.contractAddress === tokenToSell.contractAddress);
    if (!buyToken || !sellToken) {
      throw new Error('Failed to get tokens');
    }

    const newOrder: ICreateDcaOrderParams = {
      ...tradeParam,
      interval: tradeParam.interval * 60,
      walletId: w.id,
      buyTokenId: buyToken.id,
      sellTokenId: sellToken.id,
      orderType: EOrderType.Dca,
      orderStatus: EOrderStatus.Submitted,
      orderMode: null,
    };

    const order = await createOrder(newOrder, txn);
    if (!order) {
      throw new Error('failed to create order');
    }

    return { wallet: w, order };
  });
};

export const getActiveOrders = async (orderType?: EOrderType) => {
  const getOrderFilters: GetOrdersFilters = {
    orderStatus: EOrderStatus.Active,
  };
  if (orderType) {
    getOrderFilters.orderType = orderType;
  }

  const data = await db.transaction().execute(async (trx) => {
    const orders = await getOrders(getOrderFilters, trx);
    return orders;
  });
  return data;
};

export const cancelOrder = async (orderId: number, orderType?: EOrderType) => {
  await db.transaction().execute(async (trx) => {
    const order = await getOrderById(orderId, trx);
    if (!order) {
      throw new Error(`Order not found with id, ${orderId}`);
    }

    if (orderType && order.orderType !== String(orderType)) {
      throw new Error(`Order is not ${orderType} order`);
    }

    if (
      order.orderStatus === String(EOrderStatus.Cancelled) ||
      order.orderStatus === String(EOrderStatus.Completed) ||
      order.orderStatus === String(EOrderStatus.Expired) ||
      order.orderStatus === String(EOrderStatus.Failed)
    ) {
      throw new Error(`Order with id, ${orderId} is not an active order!`);
    }

    await updateOrderById(
      orderId,
      {
        orderStatus: EOrderStatus.Cancelled,
      },
      trx,
    );
  });
};
