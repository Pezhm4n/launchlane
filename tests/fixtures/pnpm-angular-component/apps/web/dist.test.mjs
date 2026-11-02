import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { invoiceTotal } from './src/invoice.mjs';
test('quantities, empty orders and fractional prices retain their original semantics', () => {
  assert.equal(invoiceTotal([{ price: 17, quantity: 3 }, { price: 8, quantity: 0 }, { price: 11, quantity: 2 }]), 73);
  assert.equal(invoiceTotal([]), 0); assert.equal(invoiceTotal([{ price: 2.5, quantity: 4 }]), 10);
});
test('Angular AOT emits nonempty hashed browser modules in the original selected configuration', () => {
  const html = readFileSync('dist/staging/client/index.html', 'utf8');
  assert.match(html, /<invoice-app>/);
  const modules = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*type="module"/g)];
  assert.ok(modules.length > 0); for (const module of modules) assert.ok(statSync('dist/staging/client/' + module[1]).size > 0);
});
