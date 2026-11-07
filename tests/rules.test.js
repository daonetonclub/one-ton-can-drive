// Donation checks: the cans limits, the drive dates and the review flag.

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../apps-script/Rules.js');

test('cans: 1 to 50 accepted', () => {
  assert.deepEqual(R.checkCans('1'), { ok: true, cans: 1 });
  assert.deepEqual(R.checkCans(50), { ok: true, cans: 50 });
  assert.deepEqual(R.checkCans(' 20 '), { ok: true, cans: 20 });
});

test('cans: 51 is refused with the "log the rest separately" message', () => {
  const r = R.checkCans(51);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'too_many');
  assert.match(r.message, /Log 50 now and the rest as a second entry/);
});

test('cans: empty, zero, decimals, negatives and text are refused, never guessed', () => {
  assert.equal(R.checkCans('').error, 'empty');
  assert.equal(R.checkCans(undefined).error, 'empty');
  for (const bad of ['0', '2.5', '-3', 'ten', '1e2']) assert.equal(R.checkCans(bad).ok, false, bad);
});

test('drive dates: refused before the start and after the end, open on both edges', () => {
  assert.equal(R.checkOpen('2027-01-18', '2027-01-19', '2027-03-04').error, 'not_started');
  assert.equal(R.checkOpen('2027-01-19', '2027-01-19', '2027-03-04').ok, true);
  assert.equal(R.checkOpen('2027-03-04', '2027-01-19', '2027-03-04').ok, true);
  assert.equal(R.checkOpen('2027-03-05', '2027-01-19', '2027-03-04').error, 'ended');
});

test('flag: 25+ cans, or a third entry within ten minutes', () => {
  const now = 10 * 60000 * 10;
  assert.equal(R.flagReason(24, now, []), '');
  assert.equal(R.flagReason(25, now, []), '25+ cans');
  assert.equal(R.flagReason(2, now, [now - 60000]), '');
  assert.equal(R.flagReason(2, now, [now - 60000, now - 120000]), 'rapid entries');
  assert.equal(R.flagReason(2, now, [now - 11 * 60000, now - 12 * 60000]), '');
});
