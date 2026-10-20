import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSavedAddress, parseSavedCustomer, serializeAddress, serializeCustomer } from "../src/lib/customer-memory";

test("customer data round-trips and rejects junk", () => {
  const raw = serializeCustomer({ name: " Ana ", phone: "+54 9 351 123 4567" });
  assert.deepEqual(parseSavedCustomer(raw), { name: "Ana", phone: "+54 9 351 123 4567" });
  assert.equal(serializeCustomer({ name: "A", phone: "1" }), null);
  assert.equal(parseSavedCustomer(null), null);
  assert.equal(parseSavedCustomer("{oops"), null);
  assert.equal(parseSavedCustomer(JSON.stringify({ name: "Ana", phone: 5 })), null);
});
test("saved address keeps the map location only when it is valid", () => {
  const raw = serializeAddress({ address: "San Martín 123", location: { lat: -31.4, lng: -64.18 } });
  assert.deepEqual(parseSavedAddress(raw), { address: "San Martín 123", location: { lat: -31.4, lng: -64.18 } });
  assert.deepEqual(parseSavedAddress(serializeAddress({ address: "San Martín 123", location: null })), { address: "San Martín 123", location: null });
  assert.equal(parseSavedAddress(JSON.stringify({ address: "San Martín 123", location: { lat: 200, lng: 0 } })), null);
  assert.equal(serializeAddress({ address: "x", location: null }), null);
});
