import { ExpressionBuilder, Transaction } from 'kysely';
import type { IPostgresInterval } from 'postgres-interval';

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

export interface IOrder {
  buyAmount: number;
  sellAmount: number;
  targetPrice: number | null;
  expirationDate?: Date | null;
  minPrice: number | null;
  maxPrice: number | null;
  interval: IPostgresInterval | null;
  frequency: number | null;
  walletId: number;
  buyTokenId: number;
  sellTokenId: number;
}

export type GetOrdersFilters = Partial<Pick<ICreateOrderParams, 'orderType' | 'orderStatus'>>;

export type UpdateOrderParams = Partial<ICreateOrderParams>;

export const createOrder = async (params: ICreateOrderParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const order = await queryCreator.insertInto('order').values(params).returningAll().executeTakeFirst();
  return order;
};

export const getOrders = async (filters?: GetOrdersFilters, trx?: Transaction<DB>): Promise<IOrder[]> => {
  const queryCreator = trx ? trx : db;
  let query = queryCreator.selectFrom('order');
  if (filters?.orderType) {
    query = query.where('order.orderType', '=', filters.orderType);
  }
  if (filters?.orderStatus) {
    query = query.where('order.orderStatus', '=', filters.orderStatus);
  }

  const orders = await query.selectAll().execute();
  return orders;
};

export const bulkUpdateByOrderIds = async (params: UpdateOrderParams, idsToUpdate: number[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const filters = (eb: ExpressionBuilder<DB, 'order'>) => {
    return eb('order.id', 'in', idsToUpdate);
  };

  await queryCreator.updateTable('order').set(params).where(filters).execute();
};
