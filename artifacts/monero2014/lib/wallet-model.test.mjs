import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendWallet, AVATAR_IDS, balances, parseWalletStore, removeWallet, selectedWallet, selectWallet, updateWallet, validatedWalletName, walletNameLength } from './wallet-model.ts';
const legacy = {
  v: 1, name: 'Test wallet', receiveAddress: 'TEST-A', currency: 'EUR', rateCents: '21000', hideBalance: true,
  txs: [{ id: 'tx1', kind: 'in', amount: '1200000000000', fee: '0', confirmations: 12, address: 'TEST-B', note: 'Keep this note', createdAt: 123456 }],
};
const initial = () => parseWalletStore(legacy);
const second = () => ({ ...initial().wallets[0], id: 'second', name: 'Wallet 2', iconId: 'alien', receiveAddress: 'TEST-C', addresses: ['TEST-C'], txs: [] });

test('pending incoming funds do not inflate spendable balance', () => {
  const tx = initial().wallets[0].txs[0];
  const settled = { ...tx, amount: '5000', confirmations: 10 };
  const pending = { ...tx, id: 'pending', amount: '2000', confirmations: 9 };
  assert.deepEqual(balances([settled, pending]), { available: 5000n, locked: 2000n, total: 7000n });
  assert.deepEqual(balances([settled, { ...pending, confirmations: 10 }]), { available: 7000n, locked: 0n, total: 7000n });
  assert.deepEqual(balances([settled, pending, { ...tx, kind: 'out', amount: '1000', fee: '10' }]), { available: 3990n, locked: 2000n, total: 5990n });
});

test('single-wallet migration preserves transactions, addresses and preferences', () => {
  const store = initial();
  assert.deepEqual(store.wallets[0].txs, legacy.txs);
  assert.equal(store.wallets[0].currency, 'EUR');
  assert.equal(store.wallets[0].hideBalance, true);
  assert.equal(store.wallets[0].rateCents, '21000');
  assert.equal(store.wallets[0].name, 'Wallet 1');
  assert.equal(store.wallets[0].needsCustomization, false);
  assert.deepEqual(store.wallets[0].addresses, ['TEST-A']);
});
test('wallet creation and selection remain separate and survive serialization', () => {
  const store = appendWallet(initial(), second());
  assert.equal(store.wallets.length, 2);
  assert.equal(store.nextWalletNumber, 3);
  assert.equal(selectedWallet(store)?.id, 'second');
  const restored = parseWalletStore(JSON.parse(JSON.stringify(selectWallet(store, 'legacy-wallet'))));
  assert.equal(selectedWallet(restored)?.txs[0].id, 'tx1');
  assert.equal(restored.wallets[1].iconId, 'alien');
  assert.equal(restored.wallets[1].txs.length, 0);
});
test('rename and avatar updates do not change another wallet or transaction data', () => {
  const before = appendWallet(initial(), second());
  const after = updateWallet(before, 'second', w => ({ ...w, name: 'Savings', iconId: 'diamond' }));
  assert.deepEqual(after.wallets[1], before.wallets[1]);
  assert.equal(after.wallets[0].name, 'Savings');
  assert.equal(before.wallets[0].name, 'Wallet 2');
  assert.throws(() => updateWallet(after, 'second', w => ({ ...w, name: '' })));
  assert.throws(() => updateWallet(after, 'second', w => ({ ...w, id: 'other' })));
});
test('removing one account preserves the other; final deletion stays empty on reload', () => {
  const both = appendWallet(initial(), second());
  const after = removeWallet(both, 'second');
  assert.equal(after.selectedId, 'legacy-wallet');
  assert.deepEqual(after.wallets[0].txs, legacy.txs);
  const empty = parseWalletStore(JSON.parse(JSON.stringify(removeWallet(after, 'legacy-wallet'))));
  assert.equal(empty.selectedId, null);
  assert.equal(empty.wallets.length, 0);
  assert.equal(empty.nextWalletNumber, 3);
});
test('corruption and unknown accounts fail explicitly rather than resetting', () => {
  assert.throws(() => parseWalletStore({ ...initial(), selectedId: 'missing' }));
  assert.throws(() => parseWalletStore({ ...initial(), wallets: [initial().wallets[0], initial().wallets[0]] }));
  assert.throws(() => parseWalletStore({ ...legacy, txs: [{ amount: 'bad' }] }));
  assert.throws(() => selectWallet(initial(), 'missing'));
  assert.throws(() => removeWallet(initial(), 'missing'));
  assert.equal(AVATAR_IDS.length, 51); // 50 Fluent emoji plus the retained Monero default.
  assert.equal(new Set(AVATAR_IDS).size, 51);
});

test('new and renamed accounts accept at most sixteen characters', () => {
  assert.equal(validatedWalletName('  My Monero  '), 'My Monero');
  assert.equal(validatedWalletName('a'.repeat(16)), 'a'.repeat(16));
  assert.equal(walletNameLength('🚀'.repeat(16)), 16);
  assert.equal(validatedWalletName('🚀'.repeat(16)), '🚀'.repeat(16));
  assert.throws(() => validatedWalletName(' '));
  assert.throws(() => appendWallet(initial(), { ...second(), name: 'a'.repeat(17) }));
  assert.throws(() => updateWallet(initial(), 'legacy-wallet', w => ({ ...w, name: 'a'.repeat(17) })));
});

test('existing longer names remain readable without resetting wallet data', () => {
  const old = { ...legacy, name: 'A previously saved wallet name' };
  const restored = parseWalletStore(old);
  assert.equal(restored.wallets[0].name, old.name);
  assert.deepEqual(restored.wallets[0].txs, legacy.txs);
  const updated = updateWallet(restored, 'legacy-wallet', w => ({ ...w, iconId: 'rocket' }));
  assert.equal(updated.wallets[0].name, old.name);
  const renamed = updateWallet(restored, 'legacy-wallet', w => ({ ...w, name: 'Savings' }));
  assert.equal(renamed.wallets[0].name, 'Savings');
});

test('wallets keep most recently opened first without changing their data', () => {
  const third = { ...second(), id: 'third', name: 'Wallet 3' };
  const created = appendWallet(appendWallet(initial(), second()), third);
  assert.deepEqual(created.wallets.map(w => w.id), ['third', 'second', 'legacy-wallet']);
  const opened = selectWallet(created, 'legacy-wallet');
  assert.deepEqual(opened.wallets.map(w => w.id), ['legacy-wallet', 'third', 'second']);
  assert.equal(opened.wallets[0], created.wallets[2]);
  assert.deepEqual(selectWallet(opened, 'legacy-wallet'), opened);
  const switched = selectWallet(opened, 'second');
  assert.deepEqual(switched.wallets.map(w => w.id), ['second', 'legacy-wallet', 'third']);
  assert.deepEqual(parseWalletStore(JSON.parse(JSON.stringify(switched))), switched);
  assert.deepEqual(removeWallet(switched, 'second').wallets.map(w => w.id), ['legacy-wallet', 'third']);
  assert.deepEqual(created.wallets.map(w => w.id), ['third', 'second', 'legacy-wallet']);
});
