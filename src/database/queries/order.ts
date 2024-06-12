import { ExpressionBuilder, Transaction } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

import { EOrderStatus } from '@/types';

import { db } from '../db';
import { DB, Order as DBOrder } from '../gen-types';

export interface ICreateOrderParams
  extends Omit<
    DBOrder,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'buyAmount'
    | 'sellAmount'
    | 'targetPrice'
    | 'expirationDate'
    | 'minPrice'
    | 'maxPrice'
    | 'interval'
    | 'frequency'
  > {
  buyAmount: number;
  sellAmount: number;
  targetPrice?: number | null;
  expirationDate?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  interval?: number | null;
  frequency?: number | null;
}

export enum ELimitOrderMode {
  BUY = 'buy',
  SELL = 'sell',
}

export interface ICreateLimitOrderParams extends ICreateOrderParams {
  orderMode: ELimitOrderMode;
}

export type GetOrdersFilters = Partial<Pick<ICreateOrderParams, 'orderType' | 'orderStatus' | 'expirationDate'>>;

export type UpdateOrderParams = Partial<ICreateOrderParams>;

export const getOrderById = async (id: number, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;
  const order = await queryCreator.selectFrom('order').where('order.id', '=', id).selectAll().executeTakeFirst();
  return order;
};

export const createOrder = async (params: ICreateOrderParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const order = await queryCreator.insertInto('order').values(params).returningAll().executeTakeFirst();
  return order;
};

export const getOrders = async (filters?: GetOrdersFilters, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;
  let query = queryCreator
    .selectFrom('order')
    .select((eb) => [
      'order.id as orderId',
      jsonObjectFrom(eb.selectFrom('token').selectAll().whereRef('buyTokenId', '=', 'token.id')).as('buy_token'),
      jsonObjectFrom(eb.selectFrom('token').selectAll().whereRef('sellTokenId', '=', 'token.id')).as('sell_token'),
    ])
    .leftJoin(
      (eb) =>
        eb
          .selectFrom('transaction')
          .select(['transactionHash', 'transactionType', 'transaction.orderId as txnOrderId'])
          .where('transaction.transactionType', '=', 'approval')
          .as('transaction'),
      (join) => join.onRef('txnOrderId', '=', 'order.id'),
    )
    .innerJoin('wallet', 'wallet.id', 'order.walletId');

  if (filters?.orderType) {
    query = query.where('order.orderType', '=', filters.orderType);
  }
  if (filters?.orderStatus) {
    if (filters.orderStatus === String(EOrderStatus.Active)) {
      const notActiveOrderStatus = [EOrderStatus.Completed, EOrderStatus.Expired, EOrderStatus.Filled] as string[];
      query = query.where('order.orderStatus', 'not in', notActiveOrderStatus);
    } else {
      query = query.where('order.orderStatus', '=', filters.orderStatus);
    }
  }

  const orders = await query.selectAll().execute();
  return orders;
};

export const updateOrderById = async (id: number, params: UpdateOrderParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;
  await queryCreator.updateTable('order').set(params).where('order.id', '=', id).execute();
};

export const bulkUpdateByOrderIds = async (params: UpdateOrderParams, idsToUpdate: number[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const filters = (eb: ExpressionBuilder<DB, 'order'>) => {
    return eb('order.id', 'in', idsToUpdate);
  };

  await queryCreator.updateTable('order').set(params).where(filters).execute();
};
