import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewSyncStatus } from './preview-sync.ts';

test('preview sync lasts exactly twenty seconds and clamps progress', () => {
  assert.deepEqual(previewSyncStatus(1000, 1000), { remainingSeconds: 20, progress: 0, complete: false });
  assert.deepEqual(previewSyncStatus(1000, 11000), { remainingSeconds: 10, progress: 0.5, complete: false });
  assert.equal(previewSyncStatus(1000, 20999).complete, false);
  assert.deepEqual(previewSyncStatus(1000, 21000), { remainingSeconds: 0, progress: 1, complete: true });
  assert.deepEqual(previewSyncStatus(1000, 90000), { remainingSeconds: 0, progress: 1, complete: true });
  assert.deepEqual(previewSyncStatus(1000, 0), { remainingSeconds: 20, progress: 0, complete: false });
});
