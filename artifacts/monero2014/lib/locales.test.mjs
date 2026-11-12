import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SUPPORTED_LANGUAGES } from './languages.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));

async function sourceStrings(directory) {
  const keys = new Set();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const key of await sourceStrings(path)) keys.add(key);
    } else if (entry.name.endsWith('.tsx')) {
      const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
            ['t', 'msg'].includes(node.expression.text) && node.arguments[0] &&
            ts.isStringLiteralLike(node.arguments[0])) keys.add(node.arguments[0].text);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return keys;
}

const sourceKeys = new Set([
  ...await sourceStrings(join(root, 'app')),
  ...await sourceStrings(join(root, 'components')),
  ...await sourceStrings(join(root, 'context')),
]);
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

for (const { code, name } of SUPPORTED_LANGUAGES.filter(language => language.code !== 'en')) {
  test(`${name} translates every marked screen string with matching placeholders`, async () => {
    const path = new URL(`../locales/${code}.ts`, import.meta.url);
    const { default: catalog } = await import(path.href);
    assert.ok(sourceKeys.size > 100, 'Expected full wallet UI source copy, not just selector labels');
    const missing = [...sourceKeys].filter(key => typeof catalog[key] !== 'string' || catalog[key].trim() === '');
    assert.deepEqual(missing, [], `Missing ${code} translations`);
    for (const key of sourceKeys) {
      assert.deepEqual(placeholders(catalog[key]), placeholders(key), `Interpolation mismatch for ${code}: ${key}`);
    }
  });
}
