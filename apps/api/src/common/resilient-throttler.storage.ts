import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type Redis from 'ioredis';

/** Never let a slow/unreachable Redis stall request handling. */
const REDIS_TIMEOUT_MS = 250;

/**
 * Redis-backed rate-limit storage with an in-memory fail-open fallback.
 *
 * With multiple API tasks, in-memory throttling multiplies every limit by the
 * task count; Redis makes limits global. Redis remains an optimization here
 * (same posture as the cache): if it is slow or down, counting falls back to
 * per-instance memory instead of failing requests.
 */
export class ResilientThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(ResilientThrottlerStorage.name);
  private readonly redisStorage: ThrottlerStorageRedisService;
  private readonly memoryStorage = new ThrottlerStorageService();
  private degraded = false;

  constructor(redis: Redis) {
    this.redisStorage = new ThrottlerStorageRedisService(redis);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const record = await withTimeout(
        this.redisStorage.increment(key, ttl, limit, blockDuration, throttlerName),
        REDIS_TIMEOUT_MS,
      );
      if (this.degraded) {
        this.degraded = false;
        this.logger.log('Redis rate-limit storage recovered.');
      }
      return record;
    } catch (error) {
      if (!this.degraded) {
        this.degraded = true;
        this.logger.warn(
          `Redis rate-limit storage unavailable (${(error as Error).message}); using per-instance memory.`,
        );
      }
      return this.memoryStorage.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  onApplicationShutdown(): void {
    this.memoryStorage.onApplicationShutdown();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
