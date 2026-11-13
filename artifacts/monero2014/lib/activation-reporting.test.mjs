import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = JSON.parse(source('../config/activation-reporting.json'));

test('reporting ships disabled without a webhook credential or recipient key', () => {
  assert.equal(config.enabled, false);
  assert.equal(config.relayUrl, '');
  assert.equal(config.recipientPublicKeyPem, '');
  assert.deepEqual(Object.keys(config).sort(), ['enabled','keyId','recipientPublicKeyPem','relayUrl']);
});

test('name-only disclosure is visible on create and rename, with no silent icon enrollment', () => {
  const screens = source('../components/account-flows.tsx');
  assert.equal((screens.match(/<ActivationDisclosure \/>/g) ?? []).length, 2);
  const notice = source('../components/activation-disclosure.tsx');
  assert.match(notice, /operator, who can decrypt it/);
  assert.match(notice, /recovery phrase, address and payment amount are not sent/);
  assert.match(source('../context/WalletContext.android.tsx'), /activationConfig.enabled && profile.name !== undefined/);
});

test('native reporting uses separate keys, persists its envelope, and never sends while Tor is enabled', () => {
  const engine = source('../modules/monero-engine/android/src/main/java/com/monero2014/engine/WalletEngine.kt');
  assert.match(engine, /if \(!foreground \|\| torEnabled\(\) \|\| !activationEligible\) return/);
  assert.match(engine, /activation-pending-\$id/);
  assert.match(engine, /activation-sent-\$id/);
  assert.match(engine, /60000/);
  const names = source('../modules/monero-engine/android/src/main/java/com/monero2014/engine/WalletNames.kt');
  assert.match(names, /monero-wallet-names-v1/);
  assert.doesNotMatch(names, /monero-file-passwords-v1/);
  const reporting = source('../modules/monero-engine/android/src/main/java/com/monero2014/engine/ActivationReports.kt');
  assert.doesNotMatch(reporting, /MONERO_Wallet_seed|MONERO_Wallet_getPolyseed|password\(/);
  assert.match(reporting, /instanceFollowRedirects = false/);
});
