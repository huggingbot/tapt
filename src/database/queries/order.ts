import { Transaction } from 'kysely';

import { db } from '../db';
import { DB, Order } from '../gen-types';

export interface ICreateOrderParams
  extends Omit<
    Order,
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

export const createOrder = async (params: ICreateOrderParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const order = await queryCreator.insertInto('order').values(params).returningAll().executeTakeFirst();
  return order;
};
