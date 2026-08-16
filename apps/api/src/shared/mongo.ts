import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Connects Mongoose. `uri` defaults to `env.MONGODB_URI`, which in every
 * real environment (dev, staging, prod) is a **replica-set** connection
 * string — `mongodb://…?replicaSet=rs0&directConnection=true` (plan.md
 * §36.6). A standalone `mongod` cannot run the multi-document
 * transactions order placement needs (create order → decrement stock →
 * increment discount usage, all-or-nothing); that requirement doesn't
 * land until the `order` module does, but the connection helper is
 * written against the production shape from day one so nobody has to
 * remember to change it later.
 *
 * The `uri` parameter exists for tests: `mongodb-memory-server` hands
 * back a URI at runtime that can't live in `env.MONGODB_URI` (parsed once
 * at module load, before the in-memory server exists).
 *
 * `autoIndex: false` always — indexes are created by a migration step at
 * deploy time, never implicitly by Mongoose (§36.6). Tests that rely on a
 * unique index (e.g. duplicate-email rejection) call
 * `Model.syncIndexes()` explicitly in their setup instead.
 */
export async function connect(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  const connection = await mongoose.connect(uri, { autoIndex: false });
  logger.info({ msg: 'mongo connected', host: connection.connection.host });
  return connection;
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
}
