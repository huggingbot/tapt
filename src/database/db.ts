import { CamelCasePlugin, CompiledQuery, Kysely, PostgresDialect } from 'kysely';
import log from 'loglevel';
import { Pool, PoolConfig } from 'pg';

import { DB } from './gen-types';

const createPostgresPool = (poolConfig: PoolConfig = {}): Pool => {
  return new Pool({
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOSTNAME,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    max: 10,
    ...poolConfig,
  });
};

const createPostgresDialect = (pool: Pool): PostgresDialect => {
  return new PostgresDialect({
    pool,
    async onCreateConnection(connection) {
      try {
        await connection.executeQuery(CompiledQuery.raw('SELECT version()'));
        log.debug('Db connection success');
      } catch (err) {
        log.error('Db connection failed', err);
      }
    },
  });
};

export const initDb = (poolConfig: PoolConfig = {}): Kysely<DB> => {
  try {
    const pool = createPostgresPool(poolConfig);
    const dialect = createPostgresDialect(pool);

    return new Kysely<DB>({
      dialect,
      plugins: [new CamelCasePlugin()],
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });
  } catch (err) {
    log.error('Failed to initialize db', err);
    throw err;
  }
};

export const db = initDb();
