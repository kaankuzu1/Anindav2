import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { EmailSenderWorker } from './email-sender';
import { WarmupWorker } from './warmup';
import { ReplyScannerWorker } from './reply-scanner';
import { WarmupScheduler } from './warmup-scheduler';
import { CampaignScheduler } from './campaign-scheduler';
import { SmartScheduler } from './smart-scheduler';
import { ConnectionChecker } from './connection-checker';
import { ABTestOptimizer } from './ab-test-optimizer';

const redisConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) {
      console.log('Redis connection failed after 3 retries, waiting 30s...');
      return 30000; // Wait 30 seconds before retrying after 3 failures
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
redisConnection.on('error', (err) => {
  if (!err.message.includes('ECONNRESET')) {
    console.error('Redis error:', err.message);
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Starting workers...');

  // Email Sender Worker
  const emailSender = new EmailSenderWorker(redisConnection, supabase);
  emailSender.start();

  // Warmup Worker
  const warmupWorker = new WarmupWorker(redisConnection, supabase);
  warmupWorker.start();

  // Warmup Scheduler (creates warmup jobs periodically)
  const warmupScheduler = new WarmupScheduler(redisConnection, supabase);
  warmupScheduler.start();

  // Reply Scanner Worker
  const replyScanner = new ReplyScannerWorker(redisConnection, supabase);
  replyScanner.start();

  // Campaign Scheduler (schedules campaign emails periodically)
  const campaignScheduler = new CampaignScheduler(redisConnection, supabase);
  campaignScheduler.start();

  // Smart Scheduler (send time optimization)
  // This provides optimized scheduling capabilities that can be used by other workers
  const smartScheduler = new SmartScheduler(redisConnection, supabase, {
    defaultWindowStart: parseInt(process.env.DEFAULT_SEND_WINDOW_START || '9', 10),
    defaultWindowEnd: parseInt(process.env.DEFAULT_SEND_WINDOW_END || '11', 10),
    preferredDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
    useHistoricalData: true,
    senderTimezone: process.env.SENDER_TIMEZONE || 'America/New_York',
  });
  console.log('Smart Scheduler initialized (send time optimization enabled)');

  // A/B Test Optimizer (periodic variant optimization)
  const abTestOptimizer = new ABTestOptimizer(redisConnection, supabase);
  abTestOptimizer.start();

  // Connection Checker (daily inbox connection validation)
  const connectionChecker = new ConnectionChecker(supabase);
  connectionChecker.start();

  console.log('All workers started');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...');
    await emailSender.stop();
    await warmupWorker.stop();
    await warmupScheduler.stop();
    await replyScanner.stop();
    await campaignScheduler.stop();
    await smartScheduler.close();
    await abTestOptimizer.stop();
    connectionChecker.stop();
    await redisConnection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
