import type { Redis } from 'ioredis';

/**
 * Fisher-Yates shuffle for an array of indices.
 */
function shuffleIndices(count: number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DEDUP_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Returns the next non-repeating template index for a given inbox-pair and template type.
 * Uses a shuffled sequence stored in Redis. When exhausted, reshuffles automatically.
 * Guarantees no repeats until the full template set cycles through.
 */
export async function getNextTemplateIndex(
  redis: Redis,
  fromId: string,
  toId: string,
  type: 'main' | 'reply' | 'continuation' | 'closer',
  count: number,
): Promise<number> {
  const key = `warmup:dedup:${fromId}:${toId}:${type}`;

  // Try to pop the next index from the list
  const val = await redis.lpop(key);
  if (val !== null) {
    // Refresh TTL on access
    await redis.expire(key, DEDUP_TTL);
    return parseInt(val, 10);
  }

  // List exhausted or doesn't exist — reshuffle
  const indices = shuffleIndices(count);
  const first = indices[0];
  const rest = indices.slice(1);

  if (rest.length > 0) {
    await redis.rpush(key, ...rest.map(String));
    await redis.expire(key, DEDUP_TTL);
  }

  return first;
}
