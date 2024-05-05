import { V3_UNISWAP_ROUTER_ADDRESS } from '@/libs/constants';
import { EOrderStatus, EOrderType, ETransactionStatus, ETransactionType, IBasicWallet } from '@/types';
import { isNumber } from '@/utils/common';

import { db } from '../db';
import { createOrder, ICreateOrderParams } from './order';
import { createTokens, ICreateTokenParams, selectTokens } from './token';
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

    const completeOrderParam = {
      ...orderParam,
      walletId: wallet.id,
      buyTokenId: inputToken.id,
      sellTokenId: outputToken.id,
      orderType: EOrderType.Market,
      orderStatus: EOrderStatus.Active,
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
  };
}) => {
  const { tokenIn, tokenOut, wallet, tradeParam } = params;
  const { buyAmount, sellAmount, targetPrice, expirationDate } = tradeParam;
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

    const tokenA = await selectTokens([tokenIn], txn);
    let buyToken = tokenA.length > 0 ? tokenA[0] : undefined;
    if (!buyToken) {
      // create if not exist
      const [newToken] = await createTokens([tokenIn], txn);
      buyToken = newToken;
    }

    const tokenB = await createTokens([tokenOut], txn);
    let sellToken = tokenB.length > 0 ? tokenB[0] : undefined;
    if (!sellToken) {
      // create if not exist
      const [newToken] = await createTokens([tokenIn], txn);
      sellToken = newToken;
    }

    console.log('buyToken', buyToken);
    console.log('sellToken', sellToken);
    const newOrder: ICreateOrderParams = {
      orderType: 'LIMIT',
      orderStatus: 'SUBMITTED',
      walletId: w.id,
      buyTokenId: buyToken.id,
      sellTokenId: sellToken.id,
      targetPrice: Number(tradeParam.targetPrice),
      buyAmount,
      sellAmount,
      expirationDate,
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
