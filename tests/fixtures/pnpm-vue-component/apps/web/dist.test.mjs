import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {invoiceTotal} from './src/invoice.js';
test('Vue source keeps quantity, zero and fractional semantics', () => {
  assert.equal(invoiceTotal([{price:17,quantity:3},{price:8,quantity:0},{price:11,quantity:2}]),73);
  assert.equal(invoiceTotal([]),0); assert.equal(invoiceTotal([{price:2.5,quantity:4}]),10);
});
test('Vue SFC compiles into the original selected output directory', () => {
  const html = readFileSync('public-build/index.html','utf8');
  assert.equal(html.includes('src/main.js'),false);
  const scripts = readdirSync('public-build/assets').filter(file=>file.endsWith('.js'));
  assert.equal(scripts.length,1);
  const built = readFileSync('public-build/assets/'+scripts[0],'utf8');
  assert.match(built,/Vue component total/); assert.match(built,/Orders total/);
});
