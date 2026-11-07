// Tests against the real web app. They add real rows to the Sheet, so they
// only run when the address is given:
//   WEBAPP_URL=https://script.google.com/macros/s/.../exec npm run test:live
// They use the fake roster (S001-S016, F001-F004), never real people.

const test = require('node:test');
const assert = require('node:assert/strict');

const URL_ = process.env.WEBAPP_URL;
const skip = !URL_ && 'set WEBAPP_URL to run the live tests';

async function call(body) {
  // text/plain, as the browser will send it, to avoid the CORS trap.
  const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                                  body: JSON.stringify(body), redirect: 'follow' });
  return res.json();
}

test('the roster response contains no emails', { skip }, async () => {
  const r = await call({ action: 'roster' });
  assert.equal(r.ok, true);
  assert.ok(r.people.length > 0);
  for (const p of r.people) assert.deepEqual(Object.keys(p).sort(), ['advisory', 'grade', 'id', 'name']);
  assert.doesNotMatch(JSON.stringify(r), /@/);
});

test('51 cans is refused', { skip }, async () => {
  const r = await call({ action: 'donate', person: 'S001', cans: 51 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'too_many');
});

test('an unknown person is refused', { skip }, async () => {
  const r = await call({ action: 'donate', person: 'NOBODY', cans: 1 });
  assert.equal(r.error, 'unknown_person');
});

test('20 donations at the same moment make exactly 20 rows', { skip, timeout: 300000 }, async () => {
  const before = await call({ action: 'leaderboard' });
  const ids = [];
  for (let i = 1; i <= 16; i++) ids.push('S' + String(i).padStart(3, '0'));
  for (let i = 1; i <= 4; i++) ids.push('F' + String(i).padStart(3, '0'));
  const results = await Promise.all(ids.map(id => call({ action: 'donate', person: id, cans: 1 })));
  const saved = results.filter(r => r.ok).length;
  const after = await call({ action: 'leaderboard' });
  // Whatever happens, the Sheet must hold exactly the donations reported saved.
  assert.equal(after.totalLb - before.totalLb, saved, 'rows match saved donations');
  assert.equal(saved, 20, 'every donation saved');
});

test('the same one-time code sent twice makes one row, not two', { skip, timeout: 120000 }, async () => {
  const before = await call({ action: 'leaderboard' });
  const request = 'livetest-' + Date.now();
  const first = await call({ action: 'donate', person: 'S010', cans: 2, request });
  const second = await call({ action: 'donate', person: 'S010', cans: 2, request });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(second, first, 'the retry gets the first answer back');
  const after = await call({ action: 'leaderboard' });
  assert.equal(after.totalLb - before.totalLb, 2 * after.poundsPerCan);
});

test('Find me: the person reply has ranks and no emails', { skip }, async () => {
  const r = await call({ action: 'person', person: 'S004' });
  assert.equal(r.ok, true);
  assert.ok(r.school && r.gradeRank && r.advisoryRank);
  assert.doesNotMatch(JSON.stringify(r), /@/);
  const unknown = await call({ action: 'person', person: 'NOBODY' });
  assert.equal(unknown.error, 'unknown_person');
});
