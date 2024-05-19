import { V3_UNISWAP_ROUTER_ADDRESS } from '@/libs/constants';
import { EOrderStatus, EOrderType, ETransactionStatus, ETransactionType, IBasicWallet } from '@/types';
import { isNumber } from '@/utils/common';

import { db } from '../db';
import { createOrder, ELimitOrderMode, ICreateLimitOrderParams, ICreateOrderParams } from './order';
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
      orderStatus: EOrderStatus.Active,
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
  tokenIn: ICreateTokenParams;
  tokenOut: ICreateTokenParams;
  wallet: IBasicWallet;
  tradeParam: {
    buyAmount: number;
    sellAmount: number;
    targetPrice: string;
    expirationDate?: string;
    orderMode: ELimitOrderMode;
  };
}) => {
  const { tokenIn, tokenOut, wallet, tradeParam } = params;
  const { buyAmount, sellAmount, targetPrice, expirationDate, orderMode } = tradeParam;
  console.log('targetPrice', targetPrice);
  if (!isNumber(targetPrice)) {
    throw new Error('invalid target price');
  }

  return await db.transaction().execute(async (txn) => {
    // wallet valiation
    const w = await getWallet(wallet, txn);
    if (!w) {
      throw new Error('Wallet not found');
    }

    const tokens = await createTokens([tokenIn, tokenOut], txn);
    if (tokens.length !== 2) {
      throw new Error('Failed to create tokens');
    }
    // in below, we need to re:find the correct token from the `tokens array` we got from `createTokens` func
    // since `createTokens` func doesn't preserve the input orders, we can't do list destructuring
    const buyToken = tokens.find((token) => token.contractAddress === tokenIn.contractAddress);
    const sellToken = tokens.find((token) => token.contractAddress === tokenOut.contractAddress);
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
      orderMode: orderMode,
    };
    const order = await createOrder(newOrder, txn);
    if (!order) {
      throw new Error('failed to create order');
    }

    return { wallet: w, order };
  });
};

export const placeDcaOrder = async () => {
  // TODO: Implement this function
};
