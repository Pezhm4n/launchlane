import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceTotal } from "./invoice.mjs";

test("invoice quantities, empty lines, zero and decimal prices retain their business meaning", () => {
  assert.equal(invoiceTotal([{price:12,quantity:5},{price:6.5,quantity:2}]),73);
  assert.equal(invoiceTotal([]),0);
  assert.equal(invoiceTotal([{price:9,quantity:0}]),0);
  assert.equal(invoiceTotal([{price:2.5,quantity:4}]),10);
});
