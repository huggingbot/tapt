import { Kysely, sql } from 'kysely';

import { DB } from '../gen-types';

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable('user')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('telegram_id', 'bigint', (col) => col.notNull().unique())
    .addColumn('username', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('wallet')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('user_id', 'integer', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('wallet_address', 'text', (col) => col.notNull())
    .addColumn('encrypted_private_key', 'text', (col) => col.notNull())
    .addColumn('chain_id', 'integer', (col) => col.notNull())
    .addUniqueConstraint('unique_wallet_address_chain_id', ['wallet_address', 'chain_id'])
    .addUniqueConstraint('unique_encrypted_private_key_chain_id', ['encrypted_private_key', 'chain_id'])
    .execute();

  await db.schema
    .createTable('token')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('symbol', 'text', (col) => col.notNull())
    .addColumn('contract_address', 'text', (col) => col.notNull())
    .addColumn('decimal_places', 'integer', (col) => col.notNull())
    .addColumn('chain_id', 'integer', (col) => col.notNull())
    .addUniqueConstraint('unique_contract_address_chain_id', ['contract_address', 'chain_id'])
    .execute();

  await db.schema
    .createTable('order')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('wallet_id', 'integer', (col) => col.notNull().references('wallet.id').onDelete('cascade'))
    .addColumn('buy_token_id', 'integer', (col) => col.notNull().references('token.id').onDelete('cascade'))
    .addColumn('sell_token_id', 'integer', (col) => col.notNull().references('token.id').onDelete('cascade'))
    .addColumn('order_type', 'text', (col) => col.notNull())
    .addColumn('order_status', 'text', (col) => col.notNull())
    .addColumn('buy_amount', 'numeric', (col) => col.notNull())
    .addColumn('sell_amount', 'numeric', (col) => col.notNull())
    .addColumn('target_price', 'numeric') // limit order
    .addColumn('expiration_date', 'timestamp') // limit order
    .addColumn('order_mode', 'text') // for limit order, 'buy' | 'sell'
    .addColumn('min_price', 'numeric') // dca order
    .addColumn('max_price', 'numeric') // dca order
    .addColumn('interval', sql`interval`) // dca order
    .addColumn('frequency', 'integer') // dca order
    .execute();

  await db.schema
    .createTable('transaction')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('wallet_id', 'integer', (col) => col.notNull().references('wallet.id').onDelete('cascade'))
    .addColumn('order_id', 'integer', (col) => col.references('order.id').onDelete('cascade'))
    .addColumn('from_address', 'text') // null if sender is the wallet
    .addColumn('to_address', 'text') // null if receiver is the wallet
    .addColumn('transaction_hash', 'text', (col) => col.notNull())
    .addColumn('transaction_fee', 'numeric')
    .addColumn('transaction_type', 'text', (col) => col.notNull())
    .addColumn('transaction_status', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable('transaction').execute();
  await db.schema.dropTable('order').execute();
  await db.schema.dropTable('token').execute();
  await db.schema.dropTable('wallet').execute();
  await db.schema.dropTable('user').execute();
}
