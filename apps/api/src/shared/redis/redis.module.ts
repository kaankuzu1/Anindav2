import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const redis = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          retryStrategy: (times) => {
            if (times > 3) {
              return 30000; // Wait 30 seconds after 3 failures
            }
            return Math.min(times * 1000, 10000); // Exponential backoff up to 10s
          },
          reconnectOnError: (err) => {
            const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
            if (targetErrors.some(e => err.message.includes(e))) {
              return true; // Reconnect on these errors
            }
            return false;
          },
        });

        // Suppress repetitive connection error logs
        redis.on('error', (err) => {
          if (!err.message.includes('ECONNRESET')) {
            console.error('Redis error:', err.message);
          }
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
