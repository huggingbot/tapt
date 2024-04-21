import { Transaction } from 'kysely';

import { db } from '../db';
import { DB, Token } from '../gen-types';

export interface ICreateTokenParams extends Omit<Token, 'id' | 'createdAt' | 'updatedAt'> {}

export const createTokens = async (params: ICreateTokenParams[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const token = await queryCreator
    .insertInto('token')
    .values(params)
    .onConflict((oc) => oc.constraint('unique_contract_address_chain_id').doNothing())
    .returningAll()
    .execute();

  return token;
};
