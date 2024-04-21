import { Transaction } from 'kysely';

import { db } from '../db';
import { DB, Transaction as TransactionTable } from '../gen-types';

export interface ICreateTransactionParams
  extends Omit<TransactionTable, 'id' | 'createdAt' | 'updatedAt' | 'fromAddress' | 'toAddress' | 'transactionFee'> {
  fromAddress?: string | null;
  toAddress?: string | null;
  transactionFee?: number;
}

export const createTransaction = async (params: ICreateTransactionParams, trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const transaction = await queryCreator.insertInto('transaction').values(params).returningAll().executeTakeFirst();
  return transaction;
};
