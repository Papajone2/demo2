import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translateText } from './translation.ts';
test('English explanatory network, node and privacy copy is never replaced by an error', () => {
  for (const source of [
    'Your wallet needs to sync with\nthe Monero network to show your\nlatest balance and transactions.',
    'Your recovery phrase is never sent to a node.',
    'No direct network fallback is used.',
  ]) assert.equal(translateText(null, source), source);
});
test('translated normal copy and placeholders remain independent of native error classification', () => {
  assert.equal(translateText({ 'About {n} minutes': 'Unos {n} minutos' }, 'About {n} minutes', { n: 20 }), 'Unos 20 minutos');
  assert.equal(translateText({}, 'Pending'), 'Pending');
});
