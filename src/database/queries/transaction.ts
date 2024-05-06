import { ExpressionBuilder, ReferenceExpression, Transaction } from 'kysely';

import { db } from '../db';
import { DB, Transaction as TransactionTable } from '../gen-types';

export interface ICreateTransactionParams
  extends Omit<TransactionTable, 'id' | 'createdAt' | 'updatedAt' | 'fromAddress' | 'toAddress' | 'transactionFee'> {
  fromAddress?: string | null;
  toAddress?: string | null;
  transactionFee?: number;
}

export interface UpdateTransactionParams
  extends Omit<TransactionTable, 'id' | 'createdAt' | 'updatedAt' | 'fromAddress' | 'toAddress' | 'transactionFee'> {
  transactionFee?: number;
  updatedAt: string;
}

export const createTransaction = async (params: ICreateTransactionParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const transaction = await queryCreator.insertInto('transaction').values(params).returningAll().executeTakeFirst();
  return transaction;
};

export const getTransactions = async (params: Partial<ICreateTransactionParams>, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;
  const buildExpression = (eb: ExpressionBuilder<DB, 'transaction'>) => {
    const filters = Object.entries(params).map(([key, value]) => {
      return eb(key as ReferenceExpression<DB, 'transaction'>, '=', value);
    });
    return eb.and(filters);
  };

  const transactions = await queryCreator.selectFrom('transaction').selectAll().where(buildExpression).execute();
  return transactions;
};

export const updateTransactionById = async (params: UpdateTransactionParams, id: number, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;
  const updateParams = { ...params, updatedAt: new Date().toISOString() };

  await queryCreator.updateTable('transaction').set(updateParams).where('transaction.id', '=', id).execute();
};
