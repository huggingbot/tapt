import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { FileMigrationProvider, Migrator } from 'kysely';
import log from 'loglevel';
import * as path from 'path';

const envPath = path.resolve('.', '.env');

dotenv.config({
  path: envPath,
});

import { initDb } from './db';

log.setLevel('DEBUG');

const migrateToLatest = async () => {
  log.debug('Running migrations');

  const db = initDb();

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      log.debug(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      log.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    log.error('Failed to migrate');
    log.error(String(error));
    process.exit(1);
  }
  log.debug('Migrations complete');
};

migrateToLatest();
