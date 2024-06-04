import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('order').renameColumn('frequency', 'duration').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('order').renameColumn('duration', 'frequency').execute();
}
