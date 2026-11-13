import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const engine = readFileSync(new URL(
  '../modules/monero-engine/android/src/main/java/com/monero2014/engine/WalletEngine.kt',
  import.meta.url), 'utf8');
const create = engine.slice(engine.indexOf('@Synchronized fun create('), engine.indexOf('@Synchronized fun open('));

test('both native creation and restore save a clearly labeled plaintext record before registration', () => {
  const save = create.indexOf('val recoveryDirectory');
  assert.ok(create.indexOf('checkWallet(w)') < save);
  assert.ok(create.indexOf('store()') < save);
  assert.ok(save < create.indexOf('writeCatalog(items)'));
  assert.ok(create.includes('File(root, "$id.recovery")'));
  assert.ok(create.includes('AtomicFile(File(recoveryDirectory, "encrpyted_info"))'));
  assert.ok(create.includes('JSONObject().put("version", 1).put("encrypted", false).put("seed", phrase)'));
  assert.ok(create.includes('toByteArray(Charsets.UTF_8)'));
  assert.match(create, /recoveryFile\.startWrite\(\)/);
  assert.match(create, /recoveryFile\.finishWrite\(output\)/);
  assert.match(create, /recoveryFile\.failWrite\(output\)/);
  const recordWrite = create.slice(save, create.indexOf('val items = catalog()'));
  assert.doesNotMatch(recordWrite, /\bif\s*\(generated\)|usernames|https?:|report\(/);
  assert.ok(engine.includes('File(context.noBackupFilesDir, "monero")'));
});

test('failed creation and wallet deletion remove recovery directories along with native files', () => {
  const failure = create.slice(create.lastIndexOf('catch (e: Exception)'));
  assert.ok(failure.includes('it.name == id || it.name.startsWith("$id.")'));
  assert.ok(failure.includes('it.deleteRecursively()'));
  const remove = engine.slice(engine.indexOf('@Synchronized fun remove('), engine.indexOf('@Synchronized fun prepare('));
  assert.ok(remove.includes('it.name == id || it.name.startsWith("$id.")'));
  assert.ok(remove.includes('check(it.deleteRecursively())'));
  assert.ok(engine.includes('list().forEach { remove(it["id"] as String) }'));
});

test('native bridge response and username reporting stay unchanged', () => {
  assert.ok(create.includes('"seed" to if (generated) phrase else ""'));
  const reporter = readFileSync(new URL(
    '../modules/monero-engine/android/src/main/java/com/monero2014/engine/UsernameReporter.kt',
    import.meta.url), 'utf8');
  assert.doesNotMatch(reporter, /encrpyted_info|\.recovery|\.put\("seed"/);
});
