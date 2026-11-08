// The whole leaderboard, checked against hand-worked answers.
// Every number below was worked out by hand from the data set.

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../apps-script/Standings.js');

const P = (id, name, grade, advisory, type) => ({ id, name, grade, advisory, type: type || 'student', email: id + '@example.com' });
const roster = [
  P('s01', 'Ann Able', 9, 'Maple'), P('s02', 'Bo Baker', 9, 'Maple'),
  P('s03', 'Cy Carter', 9, 'Birch'), P('s04', 'Di Dunn', 9, 'Birch'),
  P('s05', 'Ed Ellis', 10, 'Cedar'), P('s06', 'Flo Fox', 10, 'Cedar'), P('s07', 'Gus Gray', 10, 'Cedar'),
  P('s13', 'Mo Moss', 10, 'Pine'),
  P('s08', 'Hal Hart', 11, 'Oak'), P('s09', 'Ivy Ives', 11, 'Oak'), P('s14', 'Ned Nash', 11, 'Oak'),
  P('s10', 'Jo Jones', 12, 'Elm'), P('s11', 'Kit King', 12, 'Elm'), P('s12', 'Lu Lane', 12, 'Elm'),
  P('t01', 'Pat Teach', '', '', 'faculty'), P('t02', 'Sam Staff', '', '', 'faculty')
];
const G = (personId, cans, day, source) => ({ personId, cans, day, source: source || 'student', timestamp: 0 });
const donations = [
  G('s01', 10, '2027-01-20'), G('s02', 4, '2027-01-21'), G('s02', 3, '2027-02-02'),
  G('s03', 7, '2027-02-02'), G('s05', 5, '2027-02-02'), G('s06', 4, '2027-01-25'),
  G('s07', 3, '2027-01-26'), G('s08', 3, '2027-01-27'), G('s09', 2, '2027-01-28'),
  G('s14', 2, '2027-01-29'), G('s10', 1, '2027-01-30'), G('s11', 1, '2027-01-30'),
  G('s12', 1, '2027-01-31'),
  G('t01', 12, '2027-01-22', 'faculty'),
  G('', 30, '2027-02-01', 'pool'),
  G('s01', 50, '2027-01-18')            // before the drive: must count nowhere
];
const config = { startDay: '2027-01-19', endDay: '2027-03-04', goalLb: 2000,
                 milestones: [500, 1000, 1500, 2000], poundsPerCan: 1, fullNames: false };
const contests = [
  { name: 'Week 2', startDay: '2027-01-25', endDay: '2027-01-31', scope: 'student', filter: 'all', description: '' },
  { name: 'Nines vs tens', startDay: '2027-02-01', endDay: '2027-02-05', scope: 'grade', filter: '9,10', description: '' },
  { name: 'Later', startDay: '2027-02-10', endDay: '2027-02-20', scope: 'advisory', filter: 'all', description: '' }
];
const TODAY = '2027-02-03';
const lb = S.buildLeaderboard(donations, roster, config, contests, TODAY);
const pairs = (rows, key) => rows.map(r => [r[key || 'name'], r.total, r.rank]);

test('school total, faculty and pool lines (the January 18 donation counts nowhere)', () => {
  assert.equal(lb.totalLb, 58);      // 46 student + 12 faculty
  assert.equal(lb.facultyLb, 12);
  assert.equal(lb.poolLb, 30);       // shown, but never in the total
});

test('grade board', () => {
  assert.deepEqual(pairs(lb.grades), [['9', 24, 1], ['10', 12, 2], ['11', 7, 3], ['12', 3, 4]]);
});

test('advisory board, with ties and "x of y have donated"', () => {
  assert.deepEqual(lb.advisories.map(a => [a.name, a.total, a.rank, a.donors, a.size]), [
    ['Maple', 17, 1, 2, 2], ['Cedar', 12, 2, 3, 3], ['Birch', 7, 3, 1, 2],
    ['Oak', 7, 3, 3, 3], ['Elm', 3, 5, 3, 3], ['Pine', 0, 6, 0, 1]
  ]);
});

test('top students: ties share a place, and all three tied at #10 are shown', () => {
  assert.deepEqual(pairs(lb.topStudents), [
    ['Ann A.', 10, 1], ['Bo B.', 7, 2], ['Cy C.', 7, 2], ['Ed E.', 5, 4], ['Flo F.', 4, 5],
    ['Gus G.', 3, 6], ['Hal H.', 3, 6], ['Ivy I.', 2, 8], ['Ned N.', 2, 8],
    ['Jo J.', 1, 10], ['Kit K.', 1, 10], ['Lu L.', 1, 10]
  ]);
});

test('every student is listed for drill-down, including those with nothing', () => {
  assert.equal(lb.students.length, 14);
  assert.deepEqual(lb.students.filter(s => s.total === 0).map(s => [s.name, s.rank]), [['Di D.', 13], ['Mo M.', 13]]);
});

test('faculty board is separate and never counts on student boards', () => {
  assert.deepEqual(pairs(lb.faculty), [['Pat T.', 12, 1]]);
  assert.equal(lb.topStudents.find(r => r.id === 't01'), undefined);
});

test('pace line and everyone-brings-five', () => {
  // 1,942 lb left over 30 days (Feb 3 to Mar 4) = 64.7, rounded up.
  // Yesterday (Feb 2): 3 + 7 + 5 = 15.
  assert.deepEqual(lb.pace, { neededPerDay: 65, yesterdayLb: 15, daysLeft: 30, behind: true });
  assert.equal(lb.studentCount, 14);
  assert.equal(lb.perStudent, 143);  // 2,000 / 14, rounded up
});

test('contest boards: running contests count only donations inside their dates', () => {
  const running = lb.contests.filter(c => c.status === 'running');
  assert.deepEqual(running.map(c => c.name), ['Nines vs tens']);
  assert.deepEqual(pairs(running[0].rows), [['9', 10, 1], ['10', 5, 2]]);
  const week2 = S.buildLeaderboard(donations, roster, config, contests, '2027-01-28').contests.find(c => c.name === 'Week 2');
  assert.equal(week2.status, 'running');
  assert.deepEqual(pairs(week2.rows), [
    ['Flo F.', 4, 1], ['Gus G.', 3, 2], ['Hal H.', 3, 2], ['Ivy I.', 2, 4], ['Ned N.', 2, 4],
    ['Jo J.', 1, 6], ['Kit K.', 1, 6], ['Lu L.', 1, 6]
  ]);
});

test('contest status on the day before, the first day, the last day and the day after', () => {
  const statusOn = day => S.buildLeaderboard(donations, roster, config, contests, day).contests.find(c => c.name === 'Week 2').status;
  assert.equal(statusOn('2027-01-24'), 'upcoming');
  assert.equal(statusOn('2027-01-25'), 'running');
  assert.equal(statusOn('2027-01-31'), 'running');
  assert.equal(statusOn('2027-02-01'), 'finished');
});

test('finished contests name their winner; upcoming ones carry their start and prize', () => {
  const withPrize = contests.map(c => c.name === 'Later' ? Object.assign({}, c, { prize: 'Pizza at the game' }) : c);
  const all = S.buildLeaderboard(donations, roster, config, withPrize, TODAY).contests;
  const week2 = all.find(c => c.name === 'Week 2');
  assert.equal(week2.status, 'finished');
  assert.deepEqual(week2.winners.map(w => [w.name, w.lb]), [['Flo F.', 4]]);
  assert.equal(week2.rows, undefined, 'finished contests send only the winner');
  assert.equal(week2.prize, '', 'a blank prize stays blank; the page says "to be announced"');
  const later = all.find(c => c.name === 'Later');
  assert.deepEqual([later.status, later.startDay, later.prize, later.winners, later.rows], ['upcoming', '2027-02-10', 'Pizza at the game', undefined, undefined]);
});

test('a tie for first gives several winners; a contest with no donations has none', () => {
  const tie = { name: 'Tie', startDay: '2027-01-26', endDay: '2027-01-27', scope: 'student', filter: 'all', description: '' };
  const empty = { name: 'Empty', startDay: '2027-02-15', endDay: '2027-02-16', scope: 'advisory', filter: 'all', description: '' };
  const all = S.buildLeaderboard(donations, roster, config, [tie, empty], '2027-03-01').contests;
  assert.deepEqual(all[0].winners.map(w => w.name), ['Gus G.', 'Hal H.']);
  assert.deepEqual(all[1].winners, []);
});

test('name switch off: no full name and no email anywhere in the reply', () => {
  const json = JSON.stringify(lb);
  for (const p of roster) assert.equal(json.includes(p.name), false, p.name);
  assert.doesNotMatch(json, /@/);
});

test('name switch on: full names', () => {
  const on = S.buildLeaderboard(donations, roster, Object.assign({}, config, { fullNames: true }), contests, TODAY);
  assert.equal(on.topStudents[0].name, 'Ann Able');
  assert.doesNotMatch(JSON.stringify(on), /@/);
});

test('pounds per can changes pounds, not ranks', () => {
  const heavy = S.buildLeaderboard(donations, roster, Object.assign({}, config, { poundsPerCan: 0.85 }), contests, TODAY);
  assert.equal(heavy.totalLb, 49);   // 58 x 0.85 = 49.3
  assert.deepEqual(heavy.grades.map(g => g.rank), [1, 2, 3, 4]);
});
