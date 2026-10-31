/**
 * Version Vector System for Multi-Device Consistency
 * 
 * Uses Lamport clocks + wall clock timestamps for deterministic ordering
 * of concurrent edits across multiple devices without requiring global locks.
 */

export interface VersionVector {
  device_id: string;
  logical_clock: number;      // Per-device sequence number (Lamport clock)
  wall_clock_ms: number;      // Actual timestamp in milliseconds
  sequence: number;           // Sub-millisecond ordering
}

export interface VersionedEntity<T> {
  data: T;
  version: VersionVector;
  is_authoritative: boolean;  // APK-created expenses are always authoritative
}

/**
 * Sequence Number Tracker
 * Maintains per-millisecond sequence counter for deterministic tie-breaking
 * Persisted in localStorage and reset daily
 */
class SequenceTracker {
  private lastTimeMs: number = 0;
  private sequenceAtTime: number = 0;
  private storageKey: string = 'versionVector_sequence';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined') return; // Not in browser
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if we need to reset (daily reset)
        const today = new Date().toDateString();
        if (data.day !== today) {
          // Different day, reset
          localStorage.setItem(this.storageKey, JSON.stringify({
            lastTimeMs: 0,
            sequenceAtTime: 0,
            day: today,
          }));
        } else {
          this.lastTimeMs = data.lastTimeMs || 0;
          this.sequenceAtTime = data.sequenceAtTime || 0;
        }
      }
    } catch (err) {
      console.warn('[VERSIONING] Failed to load sequence from storage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined') return; // Not in browser
      localStorage.setItem(this.storageKey, JSON.stringify({
        lastTimeMs: this.lastTimeMs,
        sequenceAtTime: this.sequenceAtTime,
        day: new Date().toDateString(),
      }));
    } catch (err) {
      console.warn('[VERSIONING] Failed to save sequence to storage:', err);
    }
  }

  public getNextSequence(timeMs: number): number {
    if (timeMs > this.lastTimeMs) {
      // New millisecond, reset sequence
      this.lastTimeMs = timeMs;
      this.sequenceAtTime = 0;
    } else if (timeMs === this.lastTimeMs) {
      // Same millisecond, increment sequence
      this.sequenceAtTime++;
    }
    // If timeMs < lastTimeMs (clock went backwards), keep incrementing

    this.saveToStorage();
    return this.sequenceAtTime;
  }

  public reset(): void {
    this.lastTimeMs = 0;
    this.sequenceAtTime = 0;
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }
    } catch (err) {
      console.warn('[VERSIONING] Failed to reset sequence:', err);
    }
  }
}

// Global sequence tracker instance
const sequenceTracker = new SequenceTracker();

/**
 * Create a new version vector for a mutation
 */
export function createVersionVector(
  device_id: string,
  logical_clock: number,
  wall_clock_ms: number = Date.now(),
  sequence?: number // If not provided, auto-increment from tracker
): VersionVector {
  const timeMs = wall_clock_ms || Date.now();
  const seq = sequence !== undefined ? sequence : sequenceTracker.getNextSequence(timeMs);
  
  return {
    device_id,
    logical_clock,
    wall_clock_ms: timeMs,
    sequence: seq,
  };
}

/**
 * Reset the global sequence tracker (for testing or forced reset)
 */
export function resetSequenceTracker(): void {
  sequenceTracker.reset();
}

/**
 * Compare two version vectors for ordering
 * Returns:
 *   -1 if v1 < v2 (v2 is newer)
 *    0 if v1 == v2 (concurrent or identical)
 *    1 if v1 > v2 (v1 is newer)
 */
export function compareVersionVectors(v1: VersionVector, v2: VersionVector): number {
  // If both from same device, logical clock determines order
  if (v1.device_id === v2.device_id) {
    if (v1.logical_clock !== v2.logical_clock) {
      return v1.logical_clock > v2.logical_clock ? 1 : -1;
    }
    // Same device, same logical clock: use wall clock
    if (v1.wall_clock_ms !== v2.wall_clock_ms) {
      return v1.wall_clock_ms > v2.wall_clock_ms ? 1 : -1;
    }
    // Same device, same time: use sequence
    if (v1.sequence !== v2.sequence) {
      return v1.sequence > v2.sequence ? 1 : -1;
    }
    return 0; // Identical
  }

  // Different devices: use causal ordering
  // If one device has seen an update from the other, it should have a higher logical clock
  // For now, use wall clock as tie-breaker (in practice, Lamport clocks prevent this)
  if (v1.wall_clock_ms !== v2.wall_clock_ms) {
    return v1.wall_clock_ms > v2.wall_clock_ms ? 1 : -1;
  }

  // Last resort: compare device_id lexicographically (deterministic but arbitrary)
  return v1.device_id.localeCompare(v2.device_id);
}

/**
 * Check if v1 happens-before v2 (v1 <- v2)
 * True if v1 is definitely older than v2
 */
export function happensBefore(v1: VersionVector, v2: VersionVector): boolean {
  return compareVersionVectors(v1, v2) < 0;
}

/**
 * Check if v1 happens-after v2 (v1 -> v2)
 * True if v1 is definitely newer than v2
 */
export function happensAfter(v1: VersionVector, v2: VersionVector): boolean {
  return compareVersionVectors(v1, v2) > 0;
}

/**
 * Check if v1 and v2 are concurrent (neither happened before the other)
 */
export function areConcurrent(v1: VersionVector, v2: VersionVector): boolean {
  return compareVersionVectors(v1, v2) === 0 && 
         v1.device_id !== v2.device_id &&
         v1.wall_clock_ms === v2.wall_clock_ms;
}

/**
 * Merge version vectors (useful for tracking multiple sources)
 * Returns a version vector representing the maximum of both
 */
export function mergeVersionVectors(v1: VersionVector, v2: VersionVector): VersionVector {
  if (v1.device_id === v2.device_id) {
    // Same device: take the higher logical clock
    const isV1Newer = v1.logical_clock > v2.logical_clock ||
                      (v1.logical_clock === v2.logical_clock && v1.wall_clock_ms > v2.wall_clock_ms);
    return isV1Newer ? v1 : v2;
  }

  // Different devices: return the newer wall clock
  if (v1.wall_clock_ms !== v2.wall_clock_ms) {
    return v1.wall_clock_ms > v2.wall_clock_ms ? v1 : v2;
  }

  // If wall clocks are equal, use logical clock or device_id
  if (v1.logical_clock !== v2.logical_clock) {
    return v1.logical_clock > v2.logical_clock ? v1 : v2;
  }

  return v1.device_id > v2.device_id ? v1 : v2;
}

/**
 * Increment logical clock for a device's next operation
 * This is called by the client before creating a new mutation
 */
export function incrementLogicalClock(currentClock: number): number {
  return currentClock + 1;
}

/**
 * Get maximum logical clock across multiple version vectors
 * Useful when receiving updates from multiple devices
 */
export function getMaxLogicalClock(vectors: VersionVector[]): number {
  if (vectors.length === 0) return 0;
  return Math.max(...vectors.map(v => v.logical_clock));
}

/**
 * Serialize version vector to string for storage/transmission
 */
export function serializeVersionVector(v: VersionVector): string {
  return `${v.device_id}#${v.logical_clock}#${v.wall_clock_ms}#${v.sequence}`;
}

/**
 * Deserialize version vector from string
 */
export function deserializeVersionVector(str: string): VersionVector | null {
  try {
    const parts = str.split('#');
    if (parts.length !== 4) return null;
    return {
      device_id: parts[0],
      logical_clock: parseInt(parts[1], 10),
      wall_clock_ms: parseInt(parts[2], 10),
      sequence: parseInt(parts[3], 10),
    };
  } catch {
    return null;
  }
}

/**
 * Conflict resolution strategy
 * Determines which version to use when two concurrent edits exist
 */
export interface ConflictResolutionRule {
  type: 'apk_wins' | 'latest_wins' | 'manual' | 'merge';
  description: string;
}

export function resolveConflict(
  v1: VersionedEntity<any>,
  v2: VersionedEntity<any>,
  rule: ConflictResolutionRule
): VersionedEntity<any> {
  const comparison = compareVersionVectors(v1.version, v2.version);

  // If one is clearly newer, use it
  if (comparison !== 0) {
    return comparison > 0 ? v1 : v2;
  }

  // Concurrent edits: apply resolution rule
  switch (rule.type) {
    case 'apk_wins':
      // APK is authoritative for expenses
      return v1.is_authoritative ? v1 : v2.is_authoritative ? v2 : v1;

    case 'latest_wins':
      // Already determined above; use wall clock as fallback
      return v1.version.wall_clock_ms > v2.version.wall_clock_ms ? v1 : v2;

    case 'manual':
      // Should not happen in auto-sync; return first
      return v1;

    case 'merge':
      // TODO: Implement merge logic for each data type
      return v1;

    default:
      return v1;
  }
}

/**
 * Version vector comparator for sorting arrays
 */
export function versionComparator(a: VersionedEntity<any>, b: VersionedEntity<any>): number {
  return compareVersionVectors(a.version, b.version);
}

/**
 * Check if a version vector is "old enough" to be safe for offline merge
 * (i.e., it's unlikely to cause conflicts)
 */
export function isSafeForOfflineMerge(version: VersionVector, currentTime: number, maxAge: number): boolean {
  return (currentTime - version.wall_clock_ms) > maxAge;
}

/**
 * Format version vector for logging/debugging
 */
export function formatVersionVector(v: VersionVector): string {
  const date = new Date(v.wall_clock_ms);
  return `[${v.device_id}:${v.logical_clock}@${date.toISOString()}]`;
}
