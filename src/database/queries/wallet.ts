import { Transaction } from 'kysely';

import { TWallet } from '@/modules/bot/interfaces/bot-context.interface';
import { IBasicWallet } from '@/types';

import { db } from '../db';
import { DB } from '../gen-types';

interface ICreateWalletsParams extends TWallet {}

export const getWallet = async ({ walletAddress, chainId }: Pick<IBasicWallet, 'walletAddress' | 'chainId'>, trx: Transaction<DB>) => {
  const queryCreator = trx ? trx : db;

  return queryCreator
    .selectFrom('wallet')
    .select(['id', 'walletAddress', 'encryptedPrivateKey', 'chainId'])
    .where('walletAddress', '=', walletAddress)
    .where('chainId', '=', chainId)
    .executeTakeFirst();
};

export const createWallets = async (telegramId: string, params: ICreateWalletsParams[]) => {
  const user = await db.selectFrom('user').select('id').where('telegramId', '=', telegramId).executeTakeFirstOrThrow();

  const wallets = params.map(({ address, encryptedPrivateKey, chainId }) => {
    return { userId: user.id, walletAddress: address, encryptedPrivateKey, chainId };
  });

  return (
    // TODO: Query for wallets as onConflict will do nothing (no wallets returned) if wallets already exists
    db
      .insertInto('wallet')
      .values(wallets)
      // not checking `unique_wallet_address_chain_id` constraint because the address is derived from the private key
      // so it's impossible to have the same address with different private keys
      .onConflict((oc) => oc.constraint('unique_encrypted_private_key_chain_id').doNothing())
      .returning(['walletAddress', 'encryptedPrivateKey', 'chainId'])
      .execute()
  );
};
