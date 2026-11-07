// Ranking math, checked against hand-worked answers.
// Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../apps-script/Standings.js');

function person(id, grade, advisory, type) {
  return { id, name: 'Test ' + id, grade, advisory, type: type || 'student' };
}

function gift(id, cans, day, source) {
  return { personId: id, cans, day: day || '2027-01-20', source: source || 'student', timestamp: 0 };
}

// 12 students. Totals: A 10, B 7, C 7, D 7, E 5, F 3, G 3, H 1, I 1, J 1, K 1, L 0.
const roster = [
  person('A', 9, 'Maple'), person('B', 9, 'Maple'), person('C', 9, 'Birch'), person('D', 9, 'Birch'),
  person('E', 10, 'Cedar'), person('F', 10, 'Cedar'), person('G', 10, 'Pine'), person('H', 10, 'Pine'),
  person('I', 11, 'Oak'), person('J', 11, 'Oak'), person('K', 12, 'Elm'), person('L', 12, 'Elm'),
  person('T1', '', '', 'faculty'), person('T2', '', '', 'faculty')
];
const donations = [
  gift('A', 6), gift('A', 4), gift('B', 7), gift('C', 5), gift('C', 2), gift('D', 7),
  gift('E', 5), gift('F', 3), gift('G', 3), gift('H', 1), gift('I', 1), gift('J', 1), gift('K', 1),
  gift('T1', 40, '2027-01-20', 'faculty'),
  { personId: '', cans: 30, day: '2027-01-21', source: 'pool', timestamp: 0 }
];

function ranks(rows) {
  return Object.fromEntries(rows.map(r => [r.id || r.name, r.rank]));
}

test('ties share a place (1, 2, 2, 2, 5...)', () => {
  const board = S.standings(donations, roster, 'student', '', '', 'all');
  assert.deepEqual(ranks(board), { A: 1, B: 2, C: 2, D: 2, E: 5, F: 6, G: 6, H: 8, I: 8, J: 8, K: 8, L: 12 });
});

test('faculty never count on student, advisory or grade boards', () => {
  const board = S.standings(donations, roster, 'student', '', '', 'all');
  assert.equal(board.find(r => r.id === 'T1'), undefined);
  const grades = S.standings(donations, roster, 'grade', '', '', 'all');
  assert.equal(grades.reduce((sum, g) => sum + g.total, 0), 46);
});

test('school totals: faculty count toward the ton, pool does not', () => {
  const school = S.standings(donations, roster, 'school', '', '', 'all');
  assert.deepEqual(school, { student: 46, faculty: 40, pool: 30, tonCans: 86 });
});

test('advisory rows carry "x of y have donated"', () => {
  const adv = S.standings(donations, roster, 'advisory', '', '', 'all');
  const maple = adv.find(a => a.name === 'Maple');
  const elm = adv.find(a => a.name === 'Elm');
  assert.deepEqual([maple.total, maple.donors, maple.size, maple.rank], [17, 2, 2, 1]);
  assert.deepEqual([elm.total, elm.donors, elm.size], [1, 1, 2]);
});

test('grade board ranks grades', () => {
  const grades = S.standings(donations, roster, 'grade', '', '', 'all');
  assert.deepEqual(grades.map(g => [g.name, g.total, g.rank]),
    [['9', 31, 1], ['10', 12, 2], ['11', 2, 3], ['12', 1, 4]]);
});

test('move up counts to the next distinct total, not the next person', () => {
  const board = S.standings(donations, roster, 'student', '', '', 'all');
  // H has 1 and is tied with I, J, K at #8. The next distinct total is 3 (#6).
  assert.deepEqual(S.moveUp(board, 'H'), { cans: 2, rank: 6, passes: 3 });
  // L has 0. One can ties L with H, I, J, K at #8.
  assert.deepEqual(S.moveUp(board, 'L'), { cans: 1, rank: 8, passes: 0 });
  // E has 5. Two more ties E with B, C, D at #2.
  assert.deepEqual(S.moveUp(board, 'E'), { cans: 2, rank: 2, passes: 0 });
  // First place has nowhere to go.
  assert.equal(S.moveUp(board, 'A'), null);
});

test('"2 more cans puts you at #35, past 14 people" with a big tie', () => {
  const big = [];
  const gifts = [];
  for (let i = 0; i < 34; i++) { big.push(person('top' + i, 9, 'X')); gifts.push(gift('top' + i, 50 - i)); }
  for (let i = 0; i < 15; i++) { big.push(person('one' + i, 9, 'X')); gifts.push(gift('one' + i, 1)); }
  // #35 is the first person with 3 cans: the 34 above have 50 down to 17.
  big.push(person('three', 9, 'X')); gifts.push(gift('three', 3));
  const board = S.standings(gifts, big, 'student', '', '', 'all');
  assert.equal(S.findRow(board, 'id', 'three').rank, 35);
  assert.equal(S.findRow(board, 'id', 'one0').rank, 36);
  assert.deepEqual(S.moveUp(board, 'one0'), { cans: 2, rank: 35, passes: 14 });
});

test('top 10 shows everyone tied at the cut, and nobody with zero', () => {
  const r = [];
  const g = [];
  for (let i = 0; i < 9; i++) { r.push(person('p' + i, 9, 'X')); g.push(gift('p' + i, 20 - i)); }
  for (let i = 0; i < 6; i++) { r.push(person('tie' + i, 9, 'X')); g.push(gift('tie' + i, 4)); }
  r.push(person('low', 9, 'X')); g.push(gift('low', 2));
  r.push(person('none', 9, 'X'));
  const top = S.topWithTies(S.standings(g, r, 'student', '', '', 'all'), 10);
  assert.equal(top.length, 15);
  assert.ok(top.filter(x => x.id.startsWith('tie')).every(x => x.rank === 10));
  assert.equal(top.find(x => x.id === 'low' || x.id === 'none'), undefined);
});

test('contests are a date window and a grade filter on the same function', () => {
  const g = [gift('A', 5, '2027-01-19'), gift('E', 9, '2027-01-25'), gift('E', 2, '2027-02-02'), gift('I', 4, '2027-01-26')];
  const week = S.standings(g, roster, 'student', '2027-01-25', '2027-01-31', 'all');
  assert.deepEqual(week.slice(0, 2).map(r => [r.id, r.total]), [['E', 9], ['I', 4]]);
  const nineTen = S.standings(g, roster, 'grade', '', '', '9,10');
  assert.deepEqual(nineTen.map(x => x.name).sort(), ['10', '9']);
});

test('countPassed: people level with or ahead of you before, behind you after', () => {
  const before = S.standings(donations, roster, 'student', '', '', 'all');
  const after = S.standings(donations.concat([gift('E', 3)]), roster, 'student', '', '', 'all');
  // E goes from 5 to 8: passes B, C and D (7 each).
  assert.equal(S.countPassed(before, after, 'E'), 3);
  assert.equal(S.findRow(after, 'id', 'E').rank, 2);
});

test('names show as first name and last initial unless switched on', () => {
  assert.equal(S.displayName('Ben Magid', false), 'Ben M.');
  assert.equal(S.displayName('Mary Ann de la Cruz', false), 'Mary C.');
  assert.equal(S.displayName('Ben Magid', true), 'Ben Magid');
});

test('pace line and everyone-brings-five', () => {
  const p = S.pace([gift('A', 100, '2027-02-01'), gift('B', 37, '2027-02-02')],
    '2027-02-03', '2027-02-02', '2027-03-04', 2000, 1);
  // 1,863 lb left over 30 days (Feb 3 to Mar 4 inclusive) = 62.1, rounded up.
  assert.deepEqual(p, { neededPerDay: 63, yesterdayLb: 37, daysLeft: 30, behind: true });
  assert.equal(S.perStudent(2000, 1, 462), 5);
});
