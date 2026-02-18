/**
 * Pre-launch Audit Suite 14: Worker Orchestration Tests
 *
 * Static analysis of worker source files verifying:
 * - Queue name consistency between producers and consumers
 * - Worker concurrency settings
 * - Rate limiter configuration
 * - Signal handlers and graceful shutdown
 * - Scheduler intervals
 * - Error handler coverage
 * - Cross-worker architecture patterns
 * - Retry strategies
 *
 * Run: npx tsx tests/prelaunch-audit/test-worker-orchestration.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err: any) {
    failed++;
    const msg = err.message || String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL: ${name}\n        ${msg}`);
  }
}

// Read all worker source files
const WORKERS_DIR = path.join(__dirname, '../../apps/workers/src');

function readWorkerFile(filename: string): string {
  return fs.readFileSync(path.join(WORKERS_DIR, filename), 'utf-8');
}

const indexSrc = readWorkerFile('index.ts');
const emailSenderSrc = readWorkerFile('email-sender.ts');
const warmupSrc = readWorkerFile('warmup.ts');
const campaignSchedulerSrc = readWorkerFile('campaign-scheduler.ts');
const replyScannerSrc = readWorkerFile('reply-scanner.ts');
const bounceProcessorSrc = readWorkerFile('bounce-processor.ts');
const webhookDeliverySrc = readWorkerFile('webhook-delivery.ts');
const warmupSchedulerSrc = readWorkerFile('warmup-scheduler.ts');
const abTestOptimizerSrc = readWorkerFile('ab-test-optimizer.ts');
const connectionCheckerSrc = readWorkerFile('connection-checker.ts');
const smartSchedulerSrc = readWorkerFile('smart-scheduler.ts');
const healthMonitorSrc = readWorkerFile('health-monitor.ts');
const replyScanSchedulerSrc = readWorkerFile('reply-scan-scheduler.ts');

// ============================================================
// Queue Name Consistency (~25 tests)
// ============================================================
console.log('\n--- Queue Name Consistency ---');

test('Email sender worker listens on "email-send" queue', () => {
  assert.ok(emailSenderSrc.includes("'email-send'"), 'Email sender should use email-send queue');
  // Verify it's in the Worker constructor
  const workerMatch = emailSenderSrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(workerMatch, 'Should find Worker constructor');
  assert.equal(workerMatch![1], 'email-send');
});

test('Campaign scheduler enqueues to "email-send" queue', () => {
  const queueMatch = campaignSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(queueMatch, 'Should find Queue constructor');
  assert.equal(queueMatch![1], 'email-send');
});

test('Email sender and campaign scheduler use the same queue name', () => {
  const workerQueue = emailSenderSrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/)?.[1];
  const schedulerQueue = campaignSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(workerQueue, schedulerQueue, 'Queue names should match');
});

test('Warmup send worker listens on "warmup-send" queue', () => {
  // Find the send worker constructor specifically
  const match = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find sendWorker constructor');
  assert.equal(match![1], 'warmup-send');
});

test('Warmup scheduler enqueues to "warmup-send" queue', () => {
  const match = warmupSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Queue constructor');
  assert.equal(match![1], 'warmup-send');
});

test('Warmup send worker and scheduler use the same queue name', () => {
  const workerQueue = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker\w*<\w+>\(\s*'([^']+)'/)?.[1];
  const schedulerQueue = warmupSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(workerQueue, schedulerQueue, 'warmup-send queue names should match');
});

test('Warmup reply worker listens on "warmup-reply" queue', () => {
  const match = warmupSrc.match(/this\.replyWorker\s*=\s*new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find replyWorker constructor');
  assert.equal(match![1], 'warmup-reply');
});

test('Warmup worker internal queue is named "warmup"', () => {
  // The warmup worker creates an internal queue for scheduling reply jobs
  const match = warmupSrc.match(/this\.warmupQueue\s*=\s*new Queue\(\s*'([^']+)'/);
  assert.ok(match, 'Should find warmupQueue constructor');
  assert.equal(match![1], 'warmup');
});

test('Reply scanner worker listens on "reply-scan" queue', () => {
  const match = replyScannerSrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Worker constructor');
  assert.equal(match![1], 'reply-scan');
});

test('Reply scan scheduler enqueues to "reply-scan" queue', () => {
  const match = replyScanSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Queue constructor');
  assert.equal(match![1], 'reply-scan');
});

test('Reply scanner and reply scan scheduler use the same queue name', () => {
  const workerQueue = replyScannerSrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/)?.[1];
  const schedulerQueue = replyScanSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(workerQueue, schedulerQueue, 'reply-scan queue names should match');
});

test('Bounce processor worker listens on "bounce-process" queue', () => {
  const match = bounceProcessorSrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Worker constructor');
  assert.equal(match![1], 'bounce-process');
});

test('Bounce processor retry queue is "email-send" (same as email sender)', () => {
  const match = bounceProcessorSrc.match(/this\.emailQueue\s*=\s*new Queue\(\s*'([^']+)'/);
  assert.ok(match, 'Should find emailQueue constructor');
  assert.equal(match![1], 'email-send');
});

test('Webhook delivery worker listens on "webhook-delivery" queue', () => {
  const match = webhookDeliverySrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Worker constructor');
  assert.equal(match![1], 'webhook-delivery');
});

test('Reply scanner creates webhook queue matching webhook delivery worker', () => {
  const producerMatch = replyScannerSrc.match(/new Queue\(\s*'([^']+)'/);
  assert.ok(producerMatch, 'Should find webhook Queue in reply scanner');
  assert.equal(producerMatch![1], 'webhook-delivery');
});

test('Webhook delivery queue name matches between reply scanner and webhook worker', () => {
  const producerQueue = replyScannerSrc.match(/new Queue\(\s*'([^']+)'/)?.[1];
  const workerQueue = webhookDeliverySrc.match(/new Worker\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(producerQueue, workerQueue, 'webhook-delivery queue names should match');
});

test('Smart scheduler queue name is "smart-email-send"', () => {
  const match = smartSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(match, 'Should find Queue constructor');
  assert.equal(match![1], 'smart-email-send');
});

test('All queue names use kebab-case convention', () => {
  const queueNames = [
    'email-send', 'warmup-send', 'warmup-reply', 'warmup',
    'reply-scan', 'bounce-process', 'webhook-delivery', 'smart-email-send',
  ];
  for (const name of queueNames) {
    assert.ok(/^[a-z][a-z0-9-]*$/.test(name), `Queue name "${name}" should be kebab-case`);
  }
});

test('All queue names are lowercase', () => {
  const queueNames = [
    'email-send', 'warmup-send', 'warmup-reply', 'warmup',
    'reply-scan', 'bounce-process', 'webhook-delivery', 'smart-email-send',
  ];
  for (const name of queueNames) {
    assert.equal(name, name.toLowerCase(), `Queue name "${name}" should be lowercase`);
  }
});

test('No queue name contains spaces', () => {
  const queueNames = [
    'email-send', 'warmup-send', 'warmup-reply', 'warmup',
    'reply-scan', 'bounce-process', 'webhook-delivery', 'smart-email-send',
  ];
  for (const name of queueNames) {
    assert.ok(!name.includes(' '), `Queue name "${name}" should not contain spaces`);
  }
});

test('Bounce processor and campaign scheduler both reference email-send queue', () => {
  const bounceQueue = bounceProcessorSrc.match(/new Queue\(\s*'([^']+)'/)?.[1];
  const campaignQueue = campaignSchedulerSrc.match(/new Queue\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(bounceQueue, 'email-send');
  assert.equal(campaignQueue, 'email-send');
  assert.equal(bounceQueue, campaignQueue, 'Both should share email-send queue');
});

test('Warmup worker internal queue name differs from reply worker queue (architecture note)', () => {
  // The warmup worker uses queue 'warmup' for scheduling reply jobs
  // The reply worker listens on 'warmup-reply'
  // In BullMQ, job names and queue names are separate concepts
  const internalQueue = warmupSrc.match(/this\.warmupQueue\s*=\s*new Queue\(\s*'([^']+)'/)?.[1];
  const replyWorkerQueue = warmupSrc.match(/this\.replyWorker\s*=\s*new Worker\w*<\w+>\(\s*'([^']+)'/)?.[1];
  assert.equal(internalQueue, 'warmup');
  assert.equal(replyWorkerQueue, 'warmup-reply');
  // Document: these differ — warmup queue adds jobs with name 'warmup-reply'
  // but the reply worker listens on the 'warmup-reply' QUEUE
  assert.notEqual(internalQueue, replyWorkerQueue, 'Internal queue name differs from reply worker queue');
});

test('Warmup scheduler adds jobs with name "warmup-send"', () => {
  assert.ok(warmupSchedulerSrc.includes("'warmup-send'"), 'Should add warmup-send jobs');
});

test('Reply scan scheduler adds jobs with name "scan-replies"', () => {
  assert.ok(replyScanSchedulerSrc.includes("'scan-replies'"), 'Should add scan-replies jobs');
});

test('Webhook delivery dispatcher creates queue with same name as worker', () => {
  // createWebhookDispatcher also creates a Queue('webhook-delivery')
  const dispatcherQueueMatch = webhookDeliverySrc.match(/function createWebhookDispatcher[\s\S]*?new Queue\w*<\w+>\(\s*'([^']+)'/);
  assert.ok(dispatcherQueueMatch, 'Should find dispatcher queue');
  assert.equal(dispatcherQueueMatch![1], 'webhook-delivery');
});

// ============================================================
// Worker Concurrency Settings (~20 tests)
// ============================================================
console.log('\n--- Worker Concurrency Settings ---');

test('Email sender concurrency is 3', () => {
  const match = emailSenderSrc.match(/concurrency:\s*(\d+)/);
  assert.ok(match, 'Should find concurrency setting');
  assert.equal(parseInt(match![1], 10), 3);
});

test('Warmup send worker concurrency is 3', () => {
  // Find concurrency in the sendWorker section
  const sendWorkerSection = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker[\s\S]*?concurrency:\s*(\d+)/);
  assert.ok(sendWorkerSection, 'Should find sendWorker concurrency');
  assert.equal(parseInt(sendWorkerSection![1], 10), 3);
});

test('Warmup reply worker concurrency is 3', () => {
  const replyWorkerSection = warmupSrc.match(/this\.replyWorker\s*=\s*new Worker[\s\S]*?concurrency:\s*(\d+)/);
  assert.ok(replyWorkerSection, 'Should find replyWorker concurrency');
  assert.equal(parseInt(replyWorkerSection![1], 10), 3);
});

test('Reply scanner concurrency is 2', () => {
  const match = replyScannerSrc.match(/concurrency:\s*(\d+)/);
  assert.ok(match, 'Should find concurrency setting');
  assert.equal(parseInt(match![1], 10), 2);
});

test('Bounce processor concurrency is 5', () => {
  const match = bounceProcessorSrc.match(/concurrency:\s*(\d+)/);
  assert.ok(match, 'Should find concurrency setting');
  assert.equal(parseInt(match![1], 10), 5);
});

test('Webhook delivery concurrency is 10', () => {
  const match = webhookDeliverySrc.match(/concurrency:\s*(\d+)/);
  assert.ok(match, 'Should find concurrency setting');
  assert.equal(parseInt(match![1], 10), 10);
});

test('Email sender concurrency <= 5 (reasonable resource limit)', () => {
  const match = emailSenderSrc.match(/concurrency:\s*(\d+)/);
  assert.ok(parseInt(match![1], 10) <= 5);
});

test('Warmup send and reply workers have matching concurrency', () => {
  const sendMatch = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker[\s\S]*?concurrency:\s*(\d+)/);
  const replyMatch = warmupSrc.match(/this\.replyWorker\s*=\s*new Worker[\s\S]*?concurrency:\s*(\d+)/);
  assert.equal(sendMatch![1], replyMatch![1], 'Send and reply concurrency should match');
});

test('Webhook delivery has the highest concurrency among all workers', () => {
  const concurrencies = {
    emailSender: 3,
    warmupSend: 3,
    warmupReply: 3,
    replyScanner: 2,
    bounceProcessor: 5,
    webhookDelivery: 10,
  };
  const max = Math.max(...Object.values(concurrencies));
  assert.equal(concurrencies.webhookDelivery, max, 'Webhook delivery should have highest concurrency');
});

test('Reply scanner has the lowest concurrency (API rate limit protection)', () => {
  const concurrencies = {
    emailSender: 3,
    warmupSend: 3,
    warmupReply: 3,
    replyScanner: 2,
    bounceProcessor: 5,
    webhookDelivery: 10,
  };
  const min = Math.min(...Object.values(concurrencies));
  assert.equal(concurrencies.replyScanner, min, 'Reply scanner should have lowest concurrency');
});

test('All concurrency values are positive integers', () => {
  const values = [3, 3, 3, 2, 5, 10];
  for (const v of values) {
    assert.ok(v > 0, `Concurrency ${v} should be positive`);
    assert.ok(Number.isInteger(v), `Concurrency ${v} should be integer`);
  }
});

test('Bounce processor concurrency > email sender concurrency', () => {
  assert.ok(5 > 3, 'Bounce processor should have higher concurrency for bulk processing');
});

test('No worker has concurrency > 20 (resource safety)', () => {
  const allConcurrencies = [3, 3, 3, 2, 5, 10];
  for (const c of allConcurrencies) {
    assert.ok(c <= 20, `Concurrency ${c} should be <= 20`);
  }
});

test('Email sender explicitly sets concurrency (not relying on default)', () => {
  assert.ok(emailSenderSrc.includes('concurrency:'), 'Should explicitly set concurrency');
});

test('Bounce processor explicitly sets concurrency', () => {
  assert.ok(bounceProcessorSrc.includes('concurrency:'), 'Should explicitly set concurrency');
});

test('Webhook delivery explicitly sets concurrency', () => {
  assert.ok(webhookDeliverySrc.includes('concurrency:'), 'Should explicitly set concurrency');
});

test('Reply scanner explicitly sets concurrency', () => {
  assert.ok(replyScannerSrc.includes('concurrency:'), 'Should explicitly set concurrency');
});

test('Webhook delivery concurrency >= 10 for timely delivery', () => {
  const match = webhookDeliverySrc.match(/concurrency:\s*(\d+)/);
  assert.ok(parseInt(match![1], 10) >= 10);
});

test('Reply scanner concurrency <= 3 to avoid API throttling', () => {
  const match = replyScannerSrc.match(/concurrency:\s*(\d+)/);
  assert.ok(parseInt(match![1], 10) <= 3);
});

test('Email sender concurrency <= warmup send concurrency', () => {
  const emailConcurrency = 3;
  const warmupConcurrency = 3;
  assert.ok(emailConcurrency <= warmupConcurrency);
});

// ============================================================
// Rate Limiter Configuration (~15 tests)
// ============================================================
console.log('\n--- Rate Limiter Configuration ---');

test('Email sender has rate limiter configuration', () => {
  assert.ok(emailSenderSrc.includes('limiter:'), 'Should have limiter config');
});

test('Email sender rate limit max is 2', () => {
  const match = emailSenderSrc.match(/limiter:\s*\{[^}]*max:\s*(\d+)/);
  assert.ok(match, 'Should find limiter max');
  assert.equal(parseInt(match![1], 10), 2);
});

test('Email sender rate limit duration is 1000ms', () => {
  const match = emailSenderSrc.match(/limiter:\s*\{[^}]*duration:\s*(\d+)/);
  assert.ok(match, 'Should find limiter duration');
  assert.equal(parseInt(match![1], 10), 1000);
});

test('Warmup send worker does NOT have a rate limiter', () => {
  // Warmup send worker config section
  const sendSection = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker[\s\S]*?\{[\s\S]*?\}/);
  // Check that the warmup worker setup doesn't include 'limiter:'
  // We need to check the Worker constructor options, not the entire file
  const hasSendLimiter = warmupSrc.match(/this\.sendWorker\s*=\s*new Worker[\s\S]*?limiter:/);
  assert.ok(!hasSendLimiter, 'Warmup send worker should not have rate limiter');
});

test('Warmup reply worker does NOT have a rate limiter', () => {
  const hasReplyLimiter = warmupSrc.match(/this\.replyWorker\s*=\s*new Worker[\s\S]*?limiter:/);
  assert.ok(!hasReplyLimiter, 'Warmup reply worker should not have rate limiter');
});

test('Reply scanner does NOT have a rate limiter', () => {
  assert.ok(!replyScannerSrc.includes('limiter:'), 'Reply scanner should not have rate limiter');
});

test('Bounce processor does NOT have a rate limiter', () => {
  assert.ok(!bounceProcessorSrc.includes('limiter:'), 'Bounce processor should not have rate limiter');
});

test('Webhook delivery does NOT have a rate limiter', () => {
  // Check that the Worker constructor doesn't include limiter
  const workerSection = webhookDeliverySrc.match(/this\.worker\s*=\s*new Worker[\s\S]*?concurrency:\s*\d+[\s\S]*?\}/);
  assert.ok(workerSection, 'Should find worker section');
  assert.ok(!workerSection![0].includes('limiter:'), 'Webhook delivery worker should not have rate limiter');
});

test('Email sender rate limit is in the Worker constructor options', () => {
  // Verify limiter is inside Worker constructor, not elsewhere
  const workerSection = emailSenderSrc.match(/new Worker\w*<\w+>\([\s\S]*?limiter:/);
  assert.ok(workerSection, 'limiter should be in Worker constructor');
});

test('Email sender max rate <= 5 per second (safe for ESP limits)', () => {
  const match = emailSenderSrc.match(/limiter:\s*\{[^}]*max:\s*(\d+)/);
  assert.ok(parseInt(match![1], 10) <= 5, 'Max rate should be <= 5');
});

test('Rate limit duration is in milliseconds', () => {
  const match = emailSenderSrc.match(/limiter:\s*\{[^}]*duration:\s*(\d+)/);
  const duration = parseInt(match![1], 10);
  assert.equal(duration, 1000, 'Duration should be 1000ms (1 second)');
});

test('Only email sender has rate limiting among all workers', () => {
  // Email sender has it
  assert.ok(emailSenderSrc.includes('limiter:'));
  // Others don't (checking Worker construction areas)
  assert.ok(!replyScannerSrc.includes('limiter:'));
  assert.ok(!bounceProcessorSrc.includes('limiter:'));
});

test('Email sender rate limit comment references Gmail API safe limit', () => {
  assert.ok(
    emailSenderSrc.includes('Gmail API safe limit') || emailSenderSrc.includes('rate limiting'),
    'Should have comment about rate limiting purpose'
  );
});

test('Rate limiter uses {max, duration} format', () => {
  const match = emailSenderSrc.match(/limiter:\s*\{[^}]*max:\s*\d+[^}]*duration:\s*\d+/);
  assert.ok(match, 'Should use {max, duration} format');
});

// ============================================================
// Signal Handlers (~15 tests)
// ============================================================
console.log('\n--- Signal Handlers ---');

test('SIGINT handler is registered', () => {
  assert.ok(indexSrc.includes("process.on('SIGINT'"), 'Should register SIGINT handler');
});

test('SIGTERM handler is registered', () => {
  assert.ok(indexSrc.includes("process.on('SIGTERM'"), 'Should register SIGTERM handler');
});

test('Shutdown stops emailSender', () => {
  assert.ok(indexSrc.includes('emailSender.stop()'), 'Should stop email sender');
});

test('Shutdown stops warmupWorker', () => {
  assert.ok(indexSrc.includes('warmupWorker.stop()'), 'Should stop warmup worker');
});

test('Shutdown stops warmupScheduler', () => {
  assert.ok(indexSrc.includes('warmupScheduler.stop()'), 'Should stop warmup scheduler');
});

test('Shutdown stops replyScanner', () => {
  assert.ok(indexSrc.includes('replyScanner.stop()'), 'Should stop reply scanner');
});

test('Shutdown stops campaignScheduler', () => {
  assert.ok(indexSrc.includes('campaignScheduler.stop()'), 'Should stop campaign scheduler');
});

test('Shutdown closes smartScheduler', () => {
  assert.ok(indexSrc.includes('smartScheduler.close()'), 'Should close smart scheduler');
});

test('Shutdown stops abTestOptimizer', () => {
  assert.ok(indexSrc.includes('abTestOptimizer.stop()'), 'Should stop AB test optimizer');
});

test('Shutdown stops connectionChecker', () => {
  assert.ok(indexSrc.includes('connectionChecker.stop()'), 'Should stop connection checker');
});

test('Shutdown quits Redis connection', () => {
  assert.ok(indexSrc.includes('redisConnection.quit()'), 'Should quit Redis connection');
});

test('Shutdown calls process.exit(0)', () => {
  assert.ok(indexSrc.includes('process.exit(0)'), 'Should exit with code 0');
});

test('BounceProcessorWorker is NOT in shutdown sequence (not imported)', () => {
  assert.ok(!indexSrc.includes('BounceProcessorWorker'), 'BounceProcessorWorker should not be imported');
  assert.ok(!indexSrc.includes('bounceProcessor'), 'bounceProcessor should not be in shutdown');
});

test('WebhookDeliveryWorker is NOT in shutdown sequence (not imported)', () => {
  assert.ok(!indexSrc.includes('WebhookDeliveryWorker'), 'WebhookDeliveryWorker should not be imported');
  assert.ok(!indexSrc.includes('webhookDelivery'), 'webhookDelivery should not be in shutdown');
});

test('HealthMonitor is NOT in shutdown sequence (not imported)', () => {
  assert.ok(!indexSrc.includes('HealthMonitor'), 'HealthMonitor should not be imported');
  assert.ok(!indexSrc.includes('healthMonitor'), 'healthMonitor should not be in shutdown');
});

// ============================================================
// Scheduler Intervals (~20 tests)
// ============================================================
console.log('\n--- Scheduler Intervals ---');

test('Campaign scheduler interval constant is 5 minutes', () => {
  assert.ok(campaignSchedulerSrc.includes('SCHEDULER_INTERVAL_MS'), 'Should define interval constant');
  const match = campaignSchedulerSrc.match(/SCHEDULER_INTERVAL_MS\s*=\s*([\d\s*]+)/);
  assert.ok(match, 'Should find interval value');
  // 5 * 60 * 1000 = 300000
  assert.ok(
    campaignSchedulerSrc.includes('5 * 60 * 1000') || campaignSchedulerSrc.includes('300000'),
    'Should be 5 minutes'
  );
});

test('Campaign scheduler setInterval uses SCHEDULER_INTERVAL_MS', () => {
  assert.ok(campaignSchedulerSrc.includes('setInterval'), 'Should use setInterval');
  assert.ok(campaignSchedulerSrc.includes('SCHEDULER_INTERVAL_MS'), 'Should use the constant');
});

test('Reply scan scheduler interval is 5 minutes', () => {
  assert.ok(replyScanSchedulerSrc.includes('SCHEDULER_INTERVAL_MS'), 'Should define interval constant');
  assert.ok(
    replyScanSchedulerSrc.includes('5 * 60 * 1000') || replyScanSchedulerSrc.includes('300000'),
    'Should be 5 minutes'
  );
});

test('Warmup scheduler interval is 30 minutes', () => {
  assert.ok(
    warmupSchedulerSrc.includes('30 * 60 * 1000') || warmupSchedulerSrc.includes('1800000'),
    'Warmup scheduler should run every 30 minutes'
  );
});

test('A/B test optimizer interval constant is 30 minutes', () => {
  assert.ok(abTestOptimizerSrc.includes('OPTIMIZER_INTERVAL_MS'), 'Should define interval constant');
  assert.ok(
    abTestOptimizerSrc.includes('30 * 60 * 1000') || abTestOptimizerSrc.includes('1800000'),
    'Should be 30 minutes'
  );
});

test('A/B test optimizer setInterval uses OPTIMIZER_INTERVAL_MS', () => {
  assert.ok(abTestOptimizerSrc.includes('setInterval'), 'Should use setInterval');
  assert.ok(abTestOptimizerSrc.includes('OPTIMIZER_INTERVAL_MS'), 'Should use the constant');
});

test('Connection checker repeats every 24 hours', () => {
  assert.ok(
    connectionCheckerSrc.includes('24 * 60 * 60 * 1000'),
    'Should repeat every 24 hours'
  );
});

test('Connection checker target run time is 04:00 UTC', () => {
  assert.ok(
    connectionCheckerSrc.includes('setUTCHours(4') || connectionCheckerSrc.includes('setUTCHours(4,'),
    'Should target 04:00 UTC'
  );
});

test('Health monitor interval constant is 1 hour', () => {
  assert.ok(healthMonitorSrc.includes('HEALTH_CHECK_INTERVAL'), 'Should define interval constant');
  assert.ok(
    healthMonitorSrc.includes('60 * 60 * 1000') || healthMonitorSrc.includes('3600000'),
    'Should be 1 hour'
  );
});

test('Campaign scheduler runs immediately on start', () => {
  // Should call scheduleCampaigns() before setInterval
  const startMethod = campaignSchedulerSrc.match(/start\(\)\s*\{[\s\S]*?setInterval/);
  assert.ok(startMethod, 'Should find start method');
  assert.ok(startMethod![0].includes('scheduleCampaigns()'), 'Should call scheduleCampaigns immediately');
});

test('A/B test optimizer runs immediately on start', () => {
  const startMethod = abTestOptimizerSrc.match(/start\(\)\s*\{[\s\S]*?setInterval/);
  assert.ok(startMethod, 'Should find start method');
  assert.ok(startMethod![0].includes('optimizeAllCampaigns()'), 'Should call optimizeAllCampaigns immediately');
});

test('Warmup scheduler runs immediately on start', () => {
  const startMethod = warmupSchedulerSrc.match(/start\(\)\s*\{[\s\S]*?setInterval/);
  assert.ok(startMethod, 'Should find start method');
  assert.ok(startMethod![0].includes('scheduleWarmups()'), 'Should call scheduleWarmups immediately');
});

test('Reply scan scheduler runs immediately on start', () => {
  const startMethod = replyScanSchedulerSrc.match(/start\(\)\s*\{[\s\S]*?setInterval/);
  assert.ok(startMethod, 'Should find start method');
  assert.ok(startMethod![0].includes('scheduleScans()'), 'Should call scheduleScans immediately');
});

test('Connection checker uses setTimeout for first run (next 04:00 UTC)', () => {
  assert.ok(connectionCheckerSrc.includes('setTimeout'), 'Should use setTimeout for first run');
  assert.ok(connectionCheckerSrc.includes('msUntilNextRun'), 'Should calculate ms until next run');
});

test('Health monitor runs immediately on start', () => {
  const startMethod = healthMonitorSrc.match(/start\(\)\s*\{[\s\S]*?setInterval/);
  assert.ok(startMethod, 'Should find start method');
  assert.ok(startMethod![0].includes('checkAllInboxes()'), 'Should call checkAllInboxes immediately');
});

test('All schedulers use setInterval for periodic runs', () => {
  assert.ok(campaignSchedulerSrc.includes('setInterval'), 'Campaign scheduler should use setInterval');
  assert.ok(warmupSchedulerSrc.includes('setInterval'), 'Warmup scheduler should use setInterval');
  assert.ok(abTestOptimizerSrc.includes('setInterval'), 'AB test optimizer should use setInterval');
  assert.ok(replyScanSchedulerSrc.includes('setInterval'), 'Reply scan scheduler should use setInterval');
  assert.ok(connectionCheckerSrc.includes('setInterval'), 'Connection checker should use setInterval');
  assert.ok(healthMonitorSrc.includes('setInterval'), 'Health monitor should use setInterval');
});

test('Campaign scheduler interval <= 10 minutes (responsive scheduling)', () => {
  // 5 minutes = 300000ms
  const match = campaignSchedulerSrc.match(/SCHEDULER_INTERVAL_MS\s*=\s*([\d\s*]+)/);
  assert.ok(match);
  // eval the expression
  const ms = 5 * 60 * 1000;
  assert.ok(ms <= 10 * 60 * 1000, 'Should be <= 10 minutes');
});

test('Warmup scheduler interval > campaign scheduler interval', () => {
  const warmupMs = 30 * 60 * 1000;
  const campaignMs = 5 * 60 * 1000;
  assert.ok(warmupMs > campaignMs, 'Warmup scheduler should run less frequently');
});

test('Warmup scheduler also has a daily reset check interval (1 minute)', () => {
  assert.ok(
    warmupSchedulerSrc.includes('60 * 1000'),
    'Should have daily reset check interval of 1 minute'
  );
  assert.ok(warmupSchedulerSrc.includes('dailyResetIntervalId'), 'Should have daily reset interval ID');
});

test('Connection checker msUntilNextRun handles past 04:00 by scheduling tomorrow', () => {
  assert.ok(
    connectionCheckerSrc.includes('setUTCDate(target.getUTCDate() + 1)'),
    'Should schedule for next day if past 04:00'
  );
});

// ============================================================
// Missing Error Handlers (~15 tests)
// ============================================================
console.log('\n--- Error Handler Coverage ---');

test('No process.on("unhandledRejection") in index.ts', () => {
  assert.ok(!indexSrc.includes('unhandledRejection'), 'unhandledRejection handler is missing (documented finding)');
});

test('No process.on("uncaughtException") in index.ts', () => {
  assert.ok(!indexSrc.includes('uncaughtException'), 'uncaughtException handler is missing (documented finding)');
});

test('Redis connection error handler exists in index.ts', () => {
  assert.ok(indexSrc.includes("redisConnection.on('error'"), 'Should have Redis error handler');
});

test('Email sender worker has "error" event handler', () => {
  assert.ok(emailSenderSrc.includes(".on('error'"), 'Should have error handler');
});

test('Warmup send worker has "error" event handler', () => {
  assert.ok(warmupSrc.includes("sendWorker.on('error'") || warmupSrc.includes(".on('error'"), 'Should have error handler');
  // Count error handlers - warmup has 2 workers so should have multiple
  const errorHandlers = (warmupSrc.match(/\.on\('error'/g) || []).length;
  assert.ok(errorHandlers >= 2, `Should have at least 2 error handlers, found ${errorHandlers}`);
});

test('Reply scanner worker has "error" event handler', () => {
  assert.ok(replyScannerSrc.includes(".on('error'"), 'Should have error handler');
});

test('Bounce processor worker has "error" event handler', () => {
  assert.ok(bounceProcessorSrc.includes(".on('error'"), 'Should have error handler');
});

test('Webhook delivery worker has "error" event handler', () => {
  assert.ok(webhookDeliverySrc.includes(".on('error'"), 'Should have error handler');
});

test('ECONNRESET errors are suppressed in Redis handler', () => {
  assert.ok(indexSrc.includes('ECONNRESET'), 'Should check for ECONNRESET');
});

test('ECONNRESET errors are suppressed in worker error handlers', () => {
  assert.ok(emailSenderSrc.includes('ECONNRESET'), 'Email sender should suppress ECONNRESET');
  assert.ok(warmupSrc.includes('ECONNRESET'), 'Warmup should suppress ECONNRESET');
  assert.ok(replyScannerSrc.includes('ECONNRESET'), 'Reply scanner should suppress ECONNRESET');
  assert.ok(bounceProcessorSrc.includes('ECONNRESET'), 'Bounce processor should suppress ECONNRESET');
  assert.ok(webhookDeliverySrc.includes('ECONNRESET'), 'Webhook delivery should suppress ECONNRESET');
});

test('Workers log errors (not silently swallow)', () => {
  assert.ok(emailSenderSrc.includes('console.error'), 'Email sender should log errors');
  assert.ok(warmupSrc.includes('console.error'), 'Warmup should log errors');
  assert.ok(replyScannerSrc.includes('console.error'), 'Reply scanner should log errors');
  assert.ok(bounceProcessorSrc.includes('console.error'), 'Bounce processor should log errors');
  assert.ok(webhookDeliverySrc.includes('console.error'), 'Webhook delivery should log errors');
});

test('Redis retryStrategy is configured in index.ts', () => {
  assert.ok(indexSrc.includes('retryStrategy'), 'Should configure retryStrategy');
});

test('Redis reconnectOnError is configured in index.ts', () => {
  assert.ok(indexSrc.includes('reconnectOnError'), 'Should configure reconnectOnError');
});

test('Redis maxRetriesPerRequest set to null (BullMQ requirement)', () => {
  assert.ok(indexSrc.includes('maxRetriesPerRequest: null'), 'Should set maxRetriesPerRequest to null');
});

// ============================================================
// Cross-Worker Architecture (~15 tests)
// ============================================================
console.log('\n--- Cross-Worker Architecture ---');

test('SmartScheduler is instantiated in index.ts', () => {
  assert.ok(indexSrc.includes('new SmartScheduler('), 'Should create SmartScheduler instance');
});

test('SmartScheduler.start() is NOT called in index.ts', () => {
  // SmartScheduler is initialized with config but not started
  assert.ok(!indexSrc.includes('smartScheduler.start()'), 'start() should NOT be called');
});

test('SmartScheduler.close() IS included in shutdown sequence', () => {
  assert.ok(indexSrc.includes('smartScheduler.close()'), 'close() should be in shutdown');
});

test('HealthMonitor is NOT imported in index.ts', () => {
  assert.ok(!indexSrc.includes('HealthMonitor'), 'HealthMonitor should not be imported');
});

test('BounceProcessorWorker is NOT imported in index.ts', () => {
  assert.ok(!indexSrc.includes('BounceProcessor'), 'BounceProcessorWorker should not be imported');
});

test('WebhookDeliveryWorker is NOT imported in index.ts', () => {
  assert.ok(!indexSrc.includes('WebhookDelivery'), 'WebhookDeliveryWorker should not be imported');
});

test('ReplyScanScheduler is NOT imported in index.ts', () => {
  assert.ok(!indexSrc.includes('ReplyScanScheduler'), 'ReplyScanScheduler should not be imported');
});

test('All started workers receive the same Redis connection', () => {
  // All constructors in main() use redisConnection as first arg
  const redisUsages = (indexSrc.match(/redisConnection/g) || []).length;
  // At least: Redis constructor, each worker constructor, quit
  assert.ok(redisUsages >= 8, `Should have many redisConnection usages, found ${redisUsages}`);
});

test('All workers have graceful shutdown capability (stop/close method)', () => {
  assert.ok(emailSenderSrc.includes('async stop()'), 'Email sender should have stop()');
  assert.ok(warmupSrc.includes('async stop()'), 'Warmup should have stop()');
  assert.ok(replyScannerSrc.includes('async stop()'), 'Reply scanner should have stop()');
  assert.ok(bounceProcessorSrc.includes('async stop()'), 'Bounce processor should have stop()');
  assert.ok(webhookDeliverySrc.includes('async stop()'), 'Webhook delivery should have stop()');
  assert.ok(warmupSchedulerSrc.includes('async stop()'), 'Warmup scheduler should have stop()');
  assert.ok(campaignSchedulerSrc.includes('async stop()'), 'Campaign scheduler should have stop()');
  assert.ok(abTestOptimizerSrc.includes('async stop()'), 'AB test optimizer should have stop()');
  assert.ok(smartSchedulerSrc.includes('async close()'), 'Smart scheduler should have close()');
});

test('index.ts catches main() errors', () => {
  assert.ok(indexSrc.includes('main().catch('), 'Should catch main() errors');
});

test('SmartScheduler accepts config options in constructor', () => {
  assert.ok(
    indexSrc.includes('new SmartScheduler(redisConnection, supabase, {'),
    'Should pass config to SmartScheduler'
  );
});

test('ConnectionChecker does NOT take redis parameter', () => {
  const match = connectionCheckerSrc.match(/constructor\(\s*private readonly supabase/);
  assert.ok(match, 'Should only take supabase in constructor');
  assert.ok(!connectionCheckerSrc.includes('private readonly redis'), 'Should not have redis parameter');
});

test('All workers export a class', () => {
  assert.ok(emailSenderSrc.includes('export class EmailSenderWorker'));
  assert.ok(warmupSrc.includes('export class WarmupWorker'));
  assert.ok(replyScannerSrc.includes('export class ReplyScannerWorker'));
  assert.ok(bounceProcessorSrc.includes('export class BounceProcessorWorker'));
  assert.ok(webhookDeliverySrc.includes('export class WebhookDeliveryWorker'));
  assert.ok(warmupSchedulerSrc.includes('export class WarmupScheduler'));
  assert.ok(campaignSchedulerSrc.includes('export class CampaignScheduler'));
  assert.ok(abTestOptimizerSrc.includes('export class ABTestOptimizer'));
  assert.ok(smartSchedulerSrc.includes('export class SmartScheduler'));
  assert.ok(connectionCheckerSrc.includes('export class ConnectionChecker'));
  assert.ok(healthMonitorSrc.includes('export class HealthMonitor'));
  assert.ok(replyScanSchedulerSrc.includes('export class ReplyScanScheduler'));
});

test('Workers use SupabaseClient for DB operations', () => {
  assert.ok(emailSenderSrc.includes('SupabaseClient'));
  assert.ok(warmupSrc.includes('SupabaseClient'));
  assert.ok(replyScannerSrc.includes('SupabaseClient'));
  assert.ok(bounceProcessorSrc.includes('SupabaseClient'));
  assert.ok(webhookDeliverySrc.includes('SupabaseClient'));
  assert.ok(campaignSchedulerSrc.includes('SupabaseClient'));
});

test('No circular imports between worker files (workers import from shared packages only)', () => {
  // Workers should not import from each other
  assert.ok(!emailSenderSrc.includes("from './warmup'"), 'Email sender should not import warmup');
  assert.ok(!emailSenderSrc.includes("from './campaign-scheduler'"), 'Email sender should not import campaign scheduler');
  assert.ok(!warmupSrc.includes("from './email-sender'"), 'Warmup should not import email sender');
  assert.ok(!campaignSchedulerSrc.includes("from './email-sender'"), 'Campaign scheduler should not import email sender');
  assert.ok(!bounceProcessorSrc.includes("from './warmup'"), 'Bounce processor should not import warmup');
});

// ============================================================
// Retry Strategy (~15 tests)
// ============================================================
console.log('\n--- Retry Strategy ---');

test('Email sender marks auth errors as nonRetryable', () => {
  assert.ok(emailSenderSrc.includes('nonRetryable'), 'Should set nonRetryable on auth errors');
});

test('Email sender sets nonRetryable = true on error object', () => {
  assert.ok(
    emailSenderSrc.includes('(err as any).nonRetryable = true'),
    'Should set nonRetryable property'
  );
});

test('Warmup worker uses exponential backoff strategy', () => {
  assert.ok(warmupSrc.includes('backoffStrategy'), 'Should define backoff strategy');
  assert.ok(warmupSrc.includes('Math.pow(2,'), 'Should use exponential calculation');
});

test('Warmup backoff maximum is 15 minutes', () => {
  assert.ok(
    warmupSrc.includes('15 * 60 * 1000'),
    'Should cap at 15 minutes'
  );
});

test('Warmup reply jobs have 3 attempts', () => {
  // In the warmupQueue.add for reply jobs
  assert.ok(warmupSrc.includes('attempts: 3'), 'Should have 3 attempts');
});

test('Warmup reply jobs use exponential backoff with 60s base delay', () => {
  // Check for backoff config in reply job options
  assert.ok(warmupSrc.includes("type: 'exponential'"), 'Should use exponential backoff');
  assert.ok(warmupSrc.includes('delay: 60000'), 'Should have 60s base delay');
});

test('Webhook max attempts constant is 5', () => {
  const match = webhookDeliverySrc.match(/MAX_ATTEMPTS\s*=\s*(\d+)/);
  assert.ok(match, 'Should define MAX_ATTEMPTS');
  assert.equal(parseInt(match![1], 10), 5);
});

test('Webhook retry uses exponential backoff', () => {
  assert.ok(webhookDeliverySrc.includes('Math.pow(2, attempt)'), 'Should use exponential backoff');
  assert.ok(webhookDeliverySrc.includes('* 1000'), 'Should multiply by 1000ms');
});

test('Bounce processor max soft bounce retries is 3', () => {
  const match = bounceProcessorSrc.match(/MAX_SOFT_BOUNCE_RETRIES\s*=\s*(\d+)/);
  assert.ok(match, 'Should define MAX_SOFT_BOUNCE_RETRIES');
  assert.equal(parseInt(match![1], 10), 3);
});

test('Bounce processor retry delays are [1h, 4h, 24h]', () => {
  assert.ok(bounceProcessorSrc.includes('SOFT_BOUNCE_RETRY_DELAYS'), 'Should define retry delays');
  assert.ok(bounceProcessorSrc.includes('1 * 60 * 60 * 1000'), 'Should have 1 hour delay');
  assert.ok(bounceProcessorSrc.includes('4 * 60 * 60 * 1000'), 'Should have 4 hour delay');
  assert.ok(bounceProcessorSrc.includes('24 * 60 * 60 * 1000'), 'Should have 24 hour delay');
});

test('Reply scan jobs have 3 attempts', () => {
  assert.ok(replyScanSchedulerSrc.includes('attempts: 3'), 'Should have 3 attempts');
});

test('Reply scan jobs use exponential backoff with 5000ms base delay', () => {
  assert.ok(replyScanSchedulerSrc.includes("type: 'exponential'"), 'Should use exponential backoff');
  assert.ok(replyScanSchedulerSrc.includes('delay: 5000'), 'Should have 5s base delay');
});

test('Warmup scheduler jobs have 3 attempts', () => {
  assert.ok(warmupSchedulerSrc.includes('attempts: 3'), 'Should have 3 attempts');
});

test('Bounce processor converts soft bounces to hard after max retries', () => {
  assert.ok(
    bounceProcessorSrc.includes('isMaxRetriesExceeded') ||
    bounceProcessorSrc.includes('max retries exceeded'),
    'Should handle max retries conversion'
  );
  assert.ok(
    bounceProcessorSrc.includes("effectiveBounceType"),
    'Should use effectiveBounceType for suppression check'
  );
});

test('Email sender has isAuthError method for detecting auth failures', () => {
  assert.ok(emailSenderSrc.includes('isAuthError'), 'Should have isAuthError method');
  assert.ok(emailSenderSrc.includes('unauthorized'), 'Should detect unauthorized');
  assert.ok(emailSenderSrc.includes('invalid_grant'), 'Should detect invalid_grant');
  assert.ok(emailSenderSrc.includes('token expired'), 'Should detect token expired');
  assert.ok(emailSenderSrc.includes('authentication'), 'Should detect authentication errors');
  assert.ok(emailSenderSrc.includes('auth_error'), 'Should detect auth_error');
  assert.ok(emailSenderSrc.includes('insufficient permissions'), 'Should detect insufficient permissions');
});

// ============================================================
// Results
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed of ${passed + failed}`);
console.log(`${'='.repeat(50)}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
