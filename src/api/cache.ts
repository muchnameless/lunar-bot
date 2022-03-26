import { env } from 'node:process';
import Redis from 'ioredis';
import { logger } from '../functions';

export const redis = new Redis(env.REDIS_URI!);

redis.on('error', (error) => logger.error(error));
