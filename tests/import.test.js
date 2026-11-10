// Registrar export -> Roster rows, checked with made-up people only.

const test = require('node:test');
const assert = require('node:assert/strict');
const { rosterFromRegistrar } = require('../apps-script/Import.js');

const HEADER = ['Preferred Name', 'Last Name', 'Current Grade', 'Advisor', 'Email 1'];
const rows = [
  HEADER,
  ['Zed', 'Young', 'Grade 9', 'Maple, Ann', 'zy@example.com'],
  ['Amy', 'Able', 'Grade 10', 'Oak, Bea', 'aa@example.com'],
  ['  Bo ', ' Ávila ', 'Grade 12', 'Pine, Cy', 'BA@example.com'],
  ['Cal', "O’Hare", 'Grade 11', 'Oak, Dee', 'co@example.com'],
  ['Mary Jo', 'Able', 'Grade 9', 'Maple, Ann', 'mja@example.com'],
  ['', '', '', '', '']
];

test('rows come out in the Roster format, IDs in last-name order', () => {
  const r = rosterFromRegistrar(rows);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.rows.map(x => [x[0], x[1], x[2]]), [
    ['S001', 'Amy Able', 10], ['S002', 'Mary Jo Able', 9], ['S003', 'Bo Ávila', 12],
    ['S004', "Cal O’Hare", 11], ['S005', 'Zed Young', 9]
  ]);
  assert.deepEqual(r.rows[0].slice(4), ['aa@example.com', 'student', '']);
  assert.equal(r.rows[2][4], 'ba@example.com', 'emails are trimmed and lower-cased');
});

test('advisory is the last name, with an initial only when two advisors share it', () => {
  const r = rosterFromRegistrar(rows);
  const adv = Object.fromEntries(r.rows.map(x => [x[1], x[3]]));
  assert.equal(adv['Zed Young'], 'Maple');
  assert.equal(adv['Bo Ávila'], 'Pine');
  assert.equal(adv['Amy Able'], 'Oak B.');
  assert.equal(adv["Cal O’Hare"], 'Oak D.');
  assert.deepEqual(r.counts, { students: 5, advisories: 4, byGrade: { 9: 2, 10: 1, 11: 1, 12: 1 } });
});

test('the same file always gives the same IDs, whatever its row order', () => {
  const shuffled = [HEADER].concat(rows.slice(1).reverse());
  assert.deepEqual(rosterFromRegistrar(shuffled).rows, rosterFromRegistrar(rows).rows);
});

test('problems are reported by row number only, never names or emails', () => {
  const bad = rosterFromRegistrar([HEADER,
    ['Ann', 'Ames', 'Grade 13', 'Oak, Bea', 'aa@example.com'],
    ['Ben', '', 'Grade 9', '', 'not-an-email'],
    ['Cat', 'Cole', 'Grade 9', 'Oak, Bea', 'AA@example.com']]);
  assert.deepEqual(bad.problems, [
    'Row 2: grade is not 9 to 12',
    'Row 3: missing a name', 'Row 3: missing or odd email', 'Row 3: missing advisor',
    'Row 4: same email as row 2'
  ]);
  for (const p of bad.problems) assert.doesNotMatch(p, /Ann|Ben|Cat|@/);
});

test('a file without the expected columns is refused', () => {
  const r = rosterFromRegistrar([['Name', 'Grade'], ['Ann', '9']]);
  assert.equal(r.rows.length, 0);
  assert.match(r.problems[0], /^Missing column/);
});
