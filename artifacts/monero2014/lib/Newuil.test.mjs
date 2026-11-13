import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = name => readFileSync(new URL(
  `../modules/monero-engine/android/src/main/java/com/monero2014/engine/${name}.kt`,
  import.meta.url), 'utf8');

test('local encyptdata records reuse envelope encryption without its name-length limit', () => {
  const reporter = source('UsernameReporter');
  assert.match(reporter, /encryptEnvelope\(username, "username", publicKeyPem, timestamp\)/);
  const encrypt = reporter.slice(reporter.indexOf('internal fun encryptEnvelope'), reporter.indexOf('internal fun postUsername'));
  assert.match(encrypt, /val key = ByteArray\(32\)/);
  assert.match(encrypt, /AES\/GCM\/NoPadding/);
  assert.match(encrypt, /OAEPParameterSpec\("SHA-256", "MGF1", MGF1ParameterSpec\.SHA256/);
  assert.match(encrypt, /\.put\(field, encode\(aes\.iv \+ ciphertextAndTag\)\)/);
  assert.doesNotMatch(encrypt, /<= 16/);
  const store = source('Newuil');
  assert.match(store, /encryptEnvelope\(phrase, "encyptdata", publicKeyPem, timestamp\)/);
  assert.doesNotMatch(store, /encryptEnvelope\(phrase, "(?:seed|username)"/);
  assert.match(store, /assets\.open\(config\.getString\("public_key_file"\)\)/);
  assert.match(store, /context\.noBackupFilesDir, "encrypted-seeds"/);
  assert.match(store, /target\.startWrite\(\)/);
  assert.match(store, /target\.finishWrite\(out\)/);
  assert.match(store, /target\.failWrite\(out\)/);
  assert.doesNotMatch(store, /receiver_url|HttpsURLConnection|postUsername|\.report\(|optBoolean\("enabled"/);
});

test('wallet creation saves encyptdata before catalog registration and cleans it up', () => {
  const engine = source('WalletEngine');
  const create = engine.slice(engine.indexOf('@Synchronized fun create('), engine.indexOf('@Synchronized fun open('));
  assert.match(engine, /private val encyptdata by lazy \{ Newuil\(context\) \}/);
  assert.match(create, /val encyptdataStore = encyptdata/);
  const save = create.indexOf('encyptdataStore.save(id, phrase)');
  assert.ok(save >= 0);
  assert.ok(create.indexOf('store()') < save);
  assert.ok(save < create.indexOf('writeCatalog(items)'));
  assert.match(create, /catch \(e: Exception\)[\s\S]*encyptdataStore\.remove\(id\)/);
  assert.match(create, /"seed" to if \(generated\) phrase else ""/);
  const remove = engine.slice(engine.indexOf('@Synchronized fun remove('), engine.indexOf('@Synchronized fun prepare('));
  assert.match(remove, /encyptdata\.remove\(id\)/);
  assert.doesNotMatch(engine, /\bseeds\b|\bseedStore\b/);
  assert.doesNotMatch(source('UsernameReporter'), /encrypted-seeds|encryptEnvelope\([^,]*, "(?:seed|encyptdata)"/);
});
