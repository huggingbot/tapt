import { ExpressionBuilder, Transaction } from 'kysely';

import { db } from '../db';
import { DB, Token } from '../gen-types';

export interface ISelectTokensParams {
  contractAddress: string;
  chainId: number;
}
export interface ICreateTokenParams extends Omit<Token, 'id' | 'createdAt' | 'updatedAt'> {}
export interface TokenDetails {
  symbol: string;
  chainId: number;
  contractAddress: string;
  decimalPlaces: number;
}

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

export const getTokenDetailsById = async (id: number, trx?: Transaction<DB>): Promise<TokenDetails> => {
  const queryCreator = trx ? trx : db;
  const token = await queryCreator
    .selectFrom('token')
    .where('token.id', '=', id)
    .select(['symbol', 'chainId', 'contractAddress', 'decimalPlaces'])
    .executeTakeFirst();
  if (!token) {
    throw new Error(`Token with id, ${id} not found!`);
  }
  return token;
};

export const getTokenByIds = async (buyId: number, sellId: number, trx?: Transaction<DB>): Promise<TokenDetails[]> => {
  const queryCreator = trx ? trx : db;
  return await queryCreator
    .selectFrom('token')
    .where((eb) => eb.or([eb('id', '=', buyId), eb('id', '=', sellId)]))
    .select(['symbol', 'chainId', 'contractAddress', 'decimalPlaces'])
    .execute();
};

export const createTokens = async (params: ICreateTokenParams[], trx?: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  const tokensAdded = await queryCreator
    .insertInto('token')
    .values(params)
    .onConflict((oc) => oc.constraint('unique_contract_address_chain_id').doNothing())
    .execute();
  console.log('tokensAdded', tokensAdded);
  const tokens = await selectTokens(params, trx);
  return tokens;
};
