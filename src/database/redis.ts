import { Redis as TelegrafRedis } from '@telegraf/session/redis';
import { createClient } from 'redis';
import { SessionStore } from 'telegraf';

import { ExtendedSession } from '../modules/bot/interfaces/bot-context.interface';

function createRedisClient() {
  const redisConnectionURL = process.env.REDIS_URL;
  if (redisConnectionURL?.trim().length) {
    return createClient({
      url: redisConnectionURL,
      socket: {
        connectTimeout: 30000, // 30s
      },
    });
  }
  return createClient({
    socket: {
      host: process.env.REDIS_HOSTNAME,
      port: Number(process.env.REDIS_PORT),
      connectTimeout: 30000, // 30s
    },
  });
}

export const redisClient = createRedisClient();

export const telegrafClient: SessionStore<ExtendedSession> = TelegrafRedis({
  client: redisClient,
});
