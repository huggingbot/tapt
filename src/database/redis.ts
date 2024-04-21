import { Redis as TelegrafRedis } from '@telegraf/session/redis';
import { createClient } from 'redis';
import { SessionStore } from 'telegraf';

import { ExtendedSession } from '../modules/bot/interfaces/bot-context.interface';

export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOSTNAME,
    port: Number(process.env.REDIS_PORT),
    connectTimeout: 30000, // 30s
  },
});

export const telegrafClient: SessionStore<ExtendedSession> = TelegrafRedis({
  client: redisClient,
});
