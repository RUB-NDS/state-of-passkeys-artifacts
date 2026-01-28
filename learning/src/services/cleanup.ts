import { getStorage } from './storage';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cleanupIntervalId: NodeJS.Timeout | null = null;

function getMaxAgeMs(): number {
  return parseInt(process.env.INSTANCE_MAX_AGE_MS || String(DEFAULT_MAX_AGE_MS), 10);
}

function getIntervalMs(): number {
  return parseInt(process.env.CLEANUP_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10);
}

export async function runCleanup(): Promise<number> {
  const maxAgeMs = getMaxAgeMs();
  const storage = getStorage();

  try {
    const expiredIds = await storage.getExpiredInstanceIds(maxAgeMs);

    if (expiredIds.length === 0) {
      return 0;
    }

    console.log(`[Cleanup] Found ${expiredIds.length} expired instance(s)`);

    let deletedCount = 0;
    for (const instanceId of expiredIds) {
      try {
        await storage.deleteInstance(instanceId);
        deletedCount++;
      } catch (error) {
        console.error(`[Cleanup] Failed to delete instance ${instanceId}:`, error);
      }
    }

    console.log(`[Cleanup] Deleted ${deletedCount} instance(s)`);
    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
    return 0;
  }
}

export function startCleanupScheduler(): void {
  const intervalMs = getIntervalMs();
  const maxAgeHours = getMaxAgeMs() / (60 * 60 * 1000);
  const intervalMinutes = intervalMs / (60 * 1000);

  console.log(`[Cleanup] Starting scheduler: max age ${maxAgeHours}h, interval ${intervalMinutes}m`);

  // Run immediately on startup
  runCleanup().catch(console.error);

  // Schedule periodic cleanup
  cleanupIntervalId = setInterval(() => {
    runCleanup().catch(console.error);
  }, intervalMs);
}

export function stopCleanupScheduler(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[Cleanup] Scheduler stopped');
  }
}
