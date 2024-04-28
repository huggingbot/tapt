import { ExpressionBuilder, Transaction } from 'kysely';

import { db } from '../db';
import { DB, Token } from '../gen-types';

export interface ISelectTokensParams {
  contractAddress: string;
  chainId: number;
}

export interface ICreateTokenParams extends Omit<Token, 'id' | 'createdAt' | 'updatedAt'> {}

export const selectTokens = async (params: ISelectTokensParams[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const buildOrExpr = (eb: ExpressionBuilder<DB, 'token'>) => {
    const andExprs = params.map(({ contractAddress, chainId }) => {
      return eb.and([eb('contractAddress', '=', contractAddress), eb('chainId', '=', chainId)]);
    });
    return eb.or(andExprs);
  };

  return await queryCreator.selectFrom('token').selectAll().where(buildOrExpr).execute();
};

export const createTokens = async (params: ICreateTokenParams[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  await queryCreator
    .insertInto('token')
    .values(params)
    .onConflict((oc) => oc.constraint('unique_contract_address_chain_id').doNothing())
    .execute();

  const tokens = await selectTokens(params, trx);
  return tokens;
};
