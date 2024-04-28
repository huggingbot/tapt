import { jsonArrayFrom } from 'kysely/helpers/postgres';

import { db } from '../db';

export const getUserWithWallets = async (telegramId: string, chainId: number) => {
  const user = await db
    .selectFrom('user')
    .select((eb) => [
      'user.telegramId',
      'user.username',
      jsonArrayFrom(
        eb
          .selectFrom('wallet as w')
          .select(['w.walletAddress', 'w.encryptedPrivateKey', 'w.chainId'])
          .whereRef('w.userId', '=', 'user.id')
          .where('w.chainId', '=', chainId),
      ).as('wallets'),
    ])
    .where('user.telegramId', '=', telegramId)
    .executeTakeFirst();

  const wallets =
    user?.wallets.map((wallet) => {
      return {
        address: wallet.walletAddress,
        encryptedPrivateKey: wallet.encryptedPrivateKey,
        chainId: wallet.chainId,
      };
    }) ?? [];

  return user ? { ...user, wallets } : undefined;
};

export const createUser = async (telegramId: string, username: string) => {
  // TODO: Query for user as onConflict will do nothing (no user returned) if user already exists
  return db
    .insertInto('user')
    .values({ telegramId, username })
    .onConflict((oc) => oc.column('telegramId').doNothing())
    .returning(['id', 'telegramId', 'username'])
    .executeTakeFirstOrThrow();
};
