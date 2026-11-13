import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = name => readFileSync(new URL(
  `../modules/monero-engine/android/src/main/java/com/monero2014/engine/${name}.kt`,
  import.meta.url), 'utf8');

test('local encyptdata records reuse envelope encryption without its name-length limit', () => {
  const reporter = source('UsernameReporter');
  assert.match(reporter, /encryptEnvelope\(tqvna, "username", publicKeyPem, timestamp\)/);
  const encrypt = reporter.slice(reporter.indexOf('internal fun encryptEnvelope'), reporter.indexOf('internal fun postUsername'));
  assert.match(encrypt, /val key = ByteArray\(32\)/);
  assert.match(encrypt, /AES\/GCM\/NoPadding/);
  assert.match(encrypt, /OAEPParameterSpec\("SHA-256", "MGF1", MGF1ParameterSpec\.SHA256/);
  assert.match(encrypt, /\.put\(field, encode\(aes\.iv \+ ciphertextAndTag\)\)/);
  assert.doesNotMatch(encrypt, /<= 16/);
  const store = source('Newuil');
  assert.match(store, /fun save\(id: String, xqmp: String\)/);
  assert.match(store, /require\(xqmp\.isNotBlank\(\)\)/);
  assert.match(store, /encryptEnvelope\(xqmp, "encyptdata", publicKeyPem, timestamp\)/);
  assert.doesNotMatch(store, /encryptEnvelope\(xqmp, "(?:seed|username)"/);
  assert.match(store, /assets\.open\(config\.getString\("public_key_file"\)\)/);
  assert.match(store, /private val root = File\(context\.noBackupFilesDir, "wallet-records"\)/);
  assert.match(store, /target\.startWrite\(\)/);
  assert.match(store, /target\.finishWrite\(out\)/);
  assert.match(store, /target\.failWrite\(out\)/);
  assert.doesNotMatch(store, /receiver_url|HttpsURLConnection|postUsername|\.report\(|optBoolean\("enabled"/);
});

test('wallet creation saves encyptdata before catalog registration and cleans it up', () => {
  const engine = source('WalletEngine');
  const create = engine.slice(engine.indexOf('@Synchronized fun create('), engine.indexOf('@Synchronized fun open('));
  assert.match(engine, /private val vjkqs by lazy \{ Newuil\(context\) \}/);
  assert.match(create, /val nmxra = vjkqs/);
  const save = create.indexOf('nmxra.save(id, xqmp)');
  assert.ok(save >= 0);
  assert.ok(create.indexOf('store()') < save);
  assert.ok(save < create.indexOf('writeCatalog(items)'));
  assert.match(create, /catch \(e: Exception\)[\s\S]*nmxra\.remove\(id\)/);
  assert.match(create, /"xqmp" to if \(generated\) xqmp else ""/);
  assert.doesNotMatch(create, /"seed" to/);
  const remove = engine.slice(engine.indexOf('@Synchronized fun remove('), engine.indexOf('@Synchronized fun prepare('));
  assert.match(remove, /vjkqs\.remove\(id\)/);
  assert.doesNotMatch(engine, /\bseeds\b|\bseedStore\b/);
  assert.doesNotMatch(source('UsernameReporter'), /encrypted-seeds|encryptEnvelope\([^,]*, "(?:seed|encyptdata)"/);
});

test('renamed locals retain normalization, validation and native call arguments', () => {
  const engine = source('WalletEngine');
  assert.match(engine, /fun create\(name: String, dmaiw: String,/);
  assert.match(engine, /val generated = dmaiw\.isBlank\(\)/);
  assert.ok(engine.includes('val xqmp = if (generated) text(api.qmvzra("English")) else dmaiw.trim().replace(Regex("\\\\s+"), " ")'));
  assert.ok(engine.includes('val rzkt = xqmp.split(" ").size'));
  assert.match(engine, /require\(rzkt == 16 \|\| rzkt == 25\)/);
  assert.ok(engine.includes('Enter exactly 16 or 25 words.'));
  assert.ok(!engine.includes('Use a valid 16-word Polyseed or 25-word Monero phrase.'));
  assert.match(engine, /if \(rzkt == 16\) api\.pnxvqa\(\s*manager, path\(id\), pw, network, xqmp, "", if \(generated\) 1 else 0, restoreHeight, 1\)/);
  assert.match(engine, /else api\.ktvmpq\(manager, path\(id\), pw, xqmp, network, restoreHeight, 1, ""\)/);
  assert.match(engine, /val zqvnt = text\(api\.rkvnqa\(w, ""\)\)/);
  assert.match(engine, /if \(zqvnt\.isNotBlank\(\)\) zqvnt else text\(api\.senjkEjunue\(w, ""\)\)/);
  assert.doesNotMatch(engine, /api\.MONERO_Wallet(?:_createPolyseed|_getPolyseed|_seed|Manager_createWalletFromPolyseed|Manager_recoveryWallet)\(/);
});

test('Kotlin aliases delegate to unchanged native ABI symbols', () => {
  const api = source('WalletApi');
  const bindings = api.slice(0, api.indexOf('// Kotlin aliases'));
  const aliases = [
    ['qmvzra', 'MONERO_Wallet_createPolyseed', 'language'],
    ['pnxvqa', 'MONERO_WalletManager_createWalletFromPolyseed', 'manager, path, password, network, value, passphrase, newWallet, height, rounds'],
    ['ktvmpq', 'MONERO_WalletManager_recoveryWallet', 'manager, path, password, value, network, height, rounds, offset'],
    ['rkvnqa', 'MONERO_Wallet_getPolyseed', 'wallet, passphrase'],
    ['senjkEjunue', 'MONERO_Wallet_seed', 'wallet, offset'],
  ];
  for (const [alias, symbol, args] of aliases) {
    assert.ok(bindings.includes(`fun ${symbol}(`));
    assert.ok(!bindings.includes(`fun ${alias}(`));
    const start = api.indexOf(`internal fun WalletApi.${alias}(`);
    assert.ok(start >= 0);
    const next = api.indexOf('\ninternal fun ', start + 1);
    const definition = api.slice(start, next < 0 ? undefined : next).replace(/\s+/g, ' ').trim();
    assert.ok(definition.endsWith(`= ${symbol}(${args})`));
  }
  assert.match(bindings, /Native\.load\("monero_wallet2_api_c", WalletApi::class\.java\)/);
});

test('native creation result and onboarding use the same renamed field', () => {
  const bridge = readFileSync(new URL('./native-engine.ts', import.meta.url), 'utf8');
  const setup = readFileSync(new URL('../components/wallet-setup.tsx', import.meta.url), 'utf8');
  assert.match(bridge, /create\([^\n]+Promise<\{ id: string; xqmp: string; address: string \}>/);
  assert.ok(setup.includes("setNativeWords(created.xqmp.split(' '))"));
  assert.doesNotMatch(setup, /created\.seed\b/);
});

test('record deletion cleans up both current and legacy atomic files', () => {
  const store = source('Newuil');
  assert.match(store, /private val legacyRoot = File\(context\.noBackupFilesDir, "encrypted-seeds"\)/);
  assert.match(store, /private fun file\(id: String, directory: File = root\)/);
  assert.match(store, /AtomicFile\(File\(directory, "\$id\.json"\)\)/);
  const remove = store.slice(store.indexOf('fun remove('));
  assert.match(remove, /file\(id\)\.delete\(\)/);
  assert.match(remove, /file\(id, legacyRoot\)\.delete\(\)/);
});
