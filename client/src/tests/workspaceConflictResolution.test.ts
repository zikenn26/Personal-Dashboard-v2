import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSyncConflict, getWorkspaceConflicts } from '../services/syncProtocol';
import { applyWorkspaceConflictChoice, reconcileIncomingWorkspaceSnapshotV2, setCustomWorkspaceIdentifier } from '../utils/neonSync';

const makeLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
};

const workspaceId = 'account_conflict_test';

describe('Versioned workspace conflict resolution', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    setCustomWorkspaceIdentifier(workspaceId);
  });

  afterEach(() => {
    setCustomWorkspaceIdentifier('user_guest');
    vi.unstubAllGlobals();
  });

  it('directly adopts remote workspace snapshot without manual conflict prompt', async () => {
    const local = { profile: { name: 'Local name', theme: 'light' } };
    const remote = { profile: { name: 'Authoritative remote', theme: 'dark' } };

    const result = await reconcileIncomingWorkspaceSnapshotV2(local, remote, 4, '9');

    expect(result.payload).toEqual({ profile: { name: 'Authoritative remote', theme: 'dark' } });
    expect(result.needsSync).toBe(false);
    expect(await getWorkspaceConflicts(workspaceId)).toEqual([]);
  });

  it('preserves collection updates from remote authoritative workspace', async () => {
    const local = { todos: [{ id: 'task-1', title: 'Local' }] };
    const remote = { todos: [{ id: 'task-1', title: 'Remote updated' }, { id: 'task-2', title: 'New remote task' }] };

    const result = await reconcileIncomingWorkspaceSnapshotV2(local, remote, 5, '12');

    expect(result.payload.todos.length).toBe(2);
    expect(result.payload.todos[0].title).toBe('Remote updated');
    expect(result.needsSync).toBe(false);
    expect(await getWorkspaceConflicts(workspaceId)).toEqual([]);
  });

  it('applies a choice inside an item in a workspace collection', () => {
    const payload = { todos: [{ id: 'task-1', title: 'Local title' }] };
    const conflict: WorkspaceSyncConflict = {
      id: 'conflict-1', workspaceId, detectedAt: 1,
      path: ['todos', { id: 'task-1' }, 'title'],
      baseValue: 'Original', localValue: 'Local title', remoteValue: 'Remote title', remoteRevision: 3,
    };

    expect(applyWorkspaceConflictChoice(payload, conflict, 'remote').todos[0].title).toBe('Remote title');
    expect(applyWorkspaceConflictChoice(payload, conflict, 'local').todos[0].title).toBe('Local title');
  });

  it('bulk applies conflict choices across multiple fields and clears all conflicts', async () => {
    const { clearAllWorkspaceConflicts, saveWorkspaceConflicts } = await import('../services/syncProtocol');
    const conflicts: WorkspaceSyncConflict[] = [
      {
        id: 'conflict-1', workspaceId, detectedAt: 1,
        path: ['profile', 'name'],
        baseValue: 'Original', localValue: 'Local Gulshan', remoteValue: 'Remote Gulshan', remoteRevision: 10,
      },
      {
        id: 'conflict-2', workspaceId, detectedAt: 2,
        path: ['profile', 'title'],
        baseValue: 'Dev', localValue: 'Local Architect', remoteValue: 'Remote Architect', remoteRevision: 10,
      },
    ];

    await saveWorkspaceConflicts(conflicts);
    expect((await getWorkspaceConflicts(workspaceId)).length).toBe(2);

    let payload = { profile: { name: 'Original', title: 'Dev' } };
    for (const conflict of conflicts) {
      payload = applyWorkspaceConflictChoice(payload, conflict, 'remote');
    }

    expect(payload.profile.name).toBe('Remote Gulshan');
    expect(payload.profile.title).toBe('Remote Architect');

    await clearAllWorkspaceConflicts(workspaceId);
    expect(await getWorkspaceConflicts(workspaceId)).toEqual([]);
  });

  it('adopts remote workspace without creating conflicts when opening on a fresh device without prior base', async () => {
    // When a user signs into a fresh device, there is no previous baseKey in localStorage.
    // reconcileIncomingWorkspaceSnapshotV2 must simply accept the remote snapshot with no conflicts.
    const local = { profile: { name: 'Gulshan Nayak', theme: 'light' }, todos: [] };
    const remote = { profile: { name: 'Gulshan Nayak Senior', theme: 'dark' }, todos: [{ id: '1', title: 'Work' }] };

    const result = await reconcileIncomingWorkspaceSnapshotV2(local, remote, 10, '25');

    expect(result.payload.profile.name).toBe('Gulshan Nayak Senior');
    expect(result.payload.todos.length).toBe(1);
    expect(result.needsSync).toBe(false);
    expect(await getWorkspaceConflicts(workspaceId)).toEqual([]);
  });
});
