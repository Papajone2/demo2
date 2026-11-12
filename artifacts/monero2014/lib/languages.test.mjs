import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLanguageCode, resolveDeviceLanguage, SUPPORTED_LANGUAGES } from './languages.ts';

test('supported device languages resolve without network or location', () => {
  const locales = [
    ['en-GB', 'en'], ['es-419', 'es'], ['de-DE', 'de'], ['fr-CA', 'fr'],
    ['pt-BR', 'pt'], ['ru-RU', 'ru'], ['zh-CN', 'zh-Hans'], ['zh-Hans-SG', 'zh-Hans'],
    ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['tr-TR', 'tr'], ['hi-IN', 'hi'],
  ];
  for (const [tag, expected] of locales) assert.equal(resolveDeviceLanguage([tag]), expected);
  assert.equal(resolveDeviceLanguage(['PT_br']), 'pt');
});

test('unsupported or missing preferred language defaults to English', () => {
  for (const tags of [[], [''], ['is-IS'], ['ar-SA'], ['zh-Hant'], ['zh-TW'], ['zh-HK']]) {
    assert.equal(resolveDeviceLanguage(tags), 'en');
  }
  assert.equal(resolveDeviceLanguage(['is-IS', 'es-ES']), 'en');
  assert.equal(resolveDeviceLanguage(['es-ES', 'en-US']), 'es');
});

test('manual selection accepts exactly the eleven supported language codes', () => {
  assert.equal(SUPPORTED_LANGUAGES.length, 11);
  assert.equal(new Set(SUPPORTED_LANGUAGES.map(item => item.code)).size, 11);
  for (const { code, name } of SUPPORTED_LANGUAGES) {
    assert.equal(isLanguageCode(code), true);
    assert.ok(name.length > 0);
  }
  for (const code of ['is', 'zh-Hant', null, '', 'es-MX']) assert.equal(isLanguageCode(code), false);
});
