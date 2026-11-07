// Find me: one person's report, checked against hand-worked answers.

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../apps-script/Standings.js');

const P = (id, name, grade, advisory, type) => ({ id, name, grade, advisory, type: type || 'student', email: id + '@example.com' });
const roster = [
  P('A', 'Ann Able', 9, 'Maple'), P('B', 'Bo Baker', 9, 'Maple'),
  P('C', 'Cy Carter', 9, 'Birch'), P('D', 'Di Dunn', 9, 'Birch'),
  P('E', 'Ed Ellis', 10, 'Cedar'), P('F', 'Flo Fox', 10, 'Cedar'),
  P('T1', 'Pat Teach', '', '', 'faculty'), P('T2', 'Sam Staff', '', '', 'faculty')
];
const G = (personId, cans, day, source, timestamp) => ({ personId, cans, day, source: source || 'student', timestamp: timestamp || 0 });
const donations = [
  G('A', 4, '2027-01-25', 'student', 2), G('A', 6, '2027-01-20', 'student', 1),
  G('B', 7, '2027-01-21'), G('C', 7, '2027-01-22'), G('E', 5, '2027-01-23'),
  G('T1', 12, '2027-01-22', 'faculty'),
  G('A', 50, '2027-01-18')               // before the drive: not in history, not in totals
];
const config = { startDay: '2027-01-19', endDay: '2027-03-04', poundsPerCan: 1, fullNames: false };
const report = id => S.personReport(donations, roster, config, id);

// Students: A 10 (#1), B 7 (#2), C 7 (#2), E 5 (#4), D 0 (#5), F 0 (#5).

test('top of everything: ranks, total, history in order, no move-up', () => {
  const r = report('A');
  assert.equal(r.name, 'Ann A.');
  assert.deepEqual([r.school, r.gradeRank, r.advisoryRank], [{ rank: 1, of: 6 }, { rank: 1, of: 4 }, { rank: 1, of: 2 }]);
  assert.equal(r.totalCans, 10);
  assert.equal(r.totalLb, 10);
  assert.deepEqual(r.history, [{ day: '2027-01-20', cans: 6 }, { day: '2027-01-25', cans: 4 }]);
  assert.equal(r.moveUp, null);
});

test('someone who has donated nothing is still found, with a way up', () => {
  const r = report('D');
  assert.deepEqual([r.school, r.gradeRank, r.advisoryRank], [{ rank: 5, of: 6 }, { rank: 4, of: 4 }, { rank: 2, of: 2 }]);
  assert.equal(r.totalCans, 0);
  assert.deepEqual(r.history, []);
  // Next distinct total above 0 is E's 5 at #4; D would pass F (tied at 0).
  assert.deepEqual(r.moveUp, { cans: 5, rank: 4, passes: 1 });
});

test('ties: B and C share #2 in the school, B is #2 in Maple', () => {
  const b = report('B');
  assert.deepEqual([b.school, b.gradeRank, b.advisoryRank], [{ rank: 2, of: 6 }, { rank: 2, of: 4 }, { rank: 2, of: 2 }]);
  assert.deepEqual(b.moveUp, { cans: 3, rank: 1, passes: 1 });
});

test('grade rank is within the grade only', () => {
  const e = report('E');
  assert.deepEqual(e.gradeRank, { rank: 1, of: 2 });
  assert.deepEqual(e.school, { rank: 4, of: 6 });
});

test('faculty are ranked on the faculty board only', () => {
  const t2 = report('T2');
  assert.deepEqual(t2.faculty, { rank: 2, of: 2 });
  assert.equal(t2.school, undefined);
  assert.deepEqual(t2.moveUp, { cans: 12, rank: 1, passes: 0 });
  assert.deepEqual(report('T1').faculty, { rank: 1, of: 2 });
});

test('no email anywhere, unknown people get nothing, name switch on shows full names', () => {
  for (const p of roster) assert.doesNotMatch(JSON.stringify(report(p.id)), /@/);
  assert.equal(report('nobody'), null);
  const on = S.personReport(donations, roster, Object.assign({}, config, { fullNames: true }), 'A');
  assert.equal(on.name, 'Ann Able');
});

test('the leaderboard reply lists every staff member, including those with nothing', () => {
  const lb = S.buildLeaderboard(donations, roster, Object.assign({ goalLb: 2000, milestones: [] }, config), [], '2027-01-26');
  assert.deepEqual(lb.staff.map(s => [s.name, s.total, s.rank]), [['Pat T.', 12, 1], ['Sam S.', 0, 2]]);
  assert.deepEqual(lb.faculty.map(s => s.name), ['Pat T.']);
});
