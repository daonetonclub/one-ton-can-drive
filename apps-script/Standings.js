// Pure ranking math. No Sheets calls in this file, so the same code runs in
// Apps Script and in the Node tests (tests/standings.test.js).
//
// A donation here is { timestamp, day, personId, cans, source }, where day is
// "YYYY-MM-DD" in the school's time zone. A person is a Roster row:
// { id, name, grade, advisory, type }.

// Standard competition ranking: equal totals share a place (1, 2, 2, 4).
// rows must already be sorted by total, highest first.
function assignRanks(rows) {
  var rank = 0;
  for (var i = 0; i < rows.length; i++) {
    if (i === 0 || rows[i].total !== rows[i - 1].total) rank = i + 1;
    rows[i].rank = rank;
  }
  return rows;
}

function sortByTotal(rows) {
  return rows.sort(function (a, b) {
    return b.total - a.total || String(a.name).localeCompare(String(b.name));
  });
}

// "all", "", or a comma list of grades such as "9,10".
function parseFilter(filter) {
  var text = String(filter == null ? '' : filter).trim().toLowerCase();
  if (text === '' || text === 'all') return null;
  return text.split(',').map(function (g) { return Number(g.trim()); });
}

function inWindow(d, startDay, endDay) {
  return (!startDay || d.day >= startDay) && (!endDay || d.day <= endDay);
}

// The one function behind every board and every contest.
//   scope: "student", "faculty", "advisory", "grade" or "school"
//   startDay / endDay: "YYYY-MM-DD", inclusive; empty means no limit
//   filter: "all" or a grade list like "9,10"
// Student, advisory and grade boards count student rows only. Faculty rows
// only count on the faculty board. Pool rows count on no board.
function standings(donations, roster, scope, startDay, endDay, filter) {
  var grades = parseFilter(filter);
  var counted = donations.filter(function (d) { return inWindow(d, startDay, endDay); });

  if (scope === 'school') {
    var totals = { student: 0, faculty: 0, pool: 0 };
    counted.forEach(function (d) {
      if (totals[d.source] !== undefined) totals[d.source] += d.cans;
    });
    return { student: totals.student, faculty: totals.faculty, pool: totals.pool,
             tonCans: totals.student + totals.faculty };
  }

  var source = scope === 'faculty' ? 'faculty' : 'student';
  var people = roster.filter(function (p) {
    if (p.type !== source) return false;
    return !grades || grades.indexOf(Number(p.grade)) !== -1;
  });
  var byPerson = {};
  people.forEach(function (p) { byPerson[p.id] = 0; });
  counted.forEach(function (d) {
    if (d.source === source && byPerson[d.personId] !== undefined) byPerson[d.personId] += d.cans;
  });

  if (scope === 'student' || scope === 'faculty') {
    return assignRanks(sortByTotal(people.map(function (p) {
      return { id: p.id, name: p.name, grade: p.grade, advisory: p.advisory, total: byPerson[p.id] };
    })));
  }

  var key = scope === 'advisory' ? 'advisory' : 'grade';
  var groups = {};
  people.forEach(function (p) {
    var k = String(p[key]);
    if (!groups[k]) groups[k] = { name: k, grade: p.grade, total: 0, donors: 0, size: 0 };
    groups[k].size += 1;
    groups[k].total += byPerson[p.id];
    if (byPerson[p.id] > 0) groups[k].donors += 1;
  });
  return assignRanks(sortByTotal(Object.keys(groups).map(function (k) { return groups[k]; })));
}

// Top n with everyone tied at the cut included, so the list can run past n.
// People with nothing donated never appear on a top board.
function topWithTies(rows, n) {
  return rows.filter(function (r) { return r.total > 0 && r.rank <= n; });
}

function findRow(rows, key, value) {
  for (var i = 0; i < rows.length; i++) if (rows[i][key] === value) return rows[i];
  return null;
}

// What it takes to move up: the next distinct total above this person.
// Returns null for someone already in first place.
//   { cans, rank, passes } -> "2 more cans puts you at #35, past 14 people."
// passes counts everyone you would no longer be level with or behind:
// people tied with you now, plus anyone between you and the next total.
function moveUp(rows, id) {
  var me = findRow(rows, 'id', id);
  if (!me) return null;
  var next = null;
  rows.forEach(function (r) {
    if (r.total > me.total && (next === null || r.total < next.total)) next = r;
  });
  if (!next) return null;
  var passes = rows.filter(function (r) {
    return r.id !== id && r.total >= me.total && r.total < next.total;
  }).length;
  return { cans: next.total - me.total, rank: next.rank, passes: passes };
}

// People who were level with or ahead of you before, and are behind you now.
function countPassed(before, after, id) {
  var meBefore = findRow(before, 'id', id);
  var meAfter = findRow(after, 'id', id);
  if (!meBefore || !meAfter) return 0;
  var passed = 0;
  after.forEach(function (r) {
    if (r.id === id) return;
    var was = findRow(before, 'id', r.id);
    if (was && was.total >= meBefore.total && r.total < meAfter.total) passed += 1;
  });
  return passed;
}

// "Ben Magid" -> "Ben M." when full names are switched off.
function displayName(name, fullNames) {
  var text = String(name || '').trim();
  if (fullNames) return text;
  var parts = text.split(/\s+/);
  if (parts.length < 2) return text;
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
}

// Whole days from fromDay to toDay, both "YYYY-MM-DD".
function daysBetween(fromDay, toDay) {
  var a = Date.UTC(+fromDay.slice(0, 4), +fromDay.slice(5, 7) - 1, +fromDay.slice(8, 10));
  var b = Date.UTC(+toDay.slice(0, 4), +toDay.slice(5, 7) - 1, +toDay.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

// Pace line: pounds a day needed from today (inclusive) to reach the goal by
// the end date, and what the school brought in yesterday.
function pace(donations, today, yesterday, endDay, goalLb, poundsPerCan) {
  var tonCans = 0;
  var yesterdayCans = 0;
  donations.forEach(function (d) {
    if (d.source !== 'student' && d.source !== 'faculty') return;
    tonCans += d.cans;
    if (d.day === yesterday) yesterdayCans += d.cans;
  });
  var doneLb = tonCans * poundsPerCan;
  var daysLeft = Math.max(daysBetween(today, endDay) + 1, 1);
  var neededPerDay = Math.max(Math.ceil((goalLb - doneLb) / daysLeft), 0);
  var yesterdayLb = Math.round(yesterdayCans * poundsPerCan);
  return { neededPerDay: neededPerDay, yesterdayLb: yesterdayLb, daysLeft: daysLeft,
           behind: yesterdayLb < neededPerDay };
}

// "If everyone brings five": cans each student would need to bring.
function perStudent(goalLb, poundsPerCan, studentCount) {
  if (!studentCount) return 0;
  return Math.ceil(goalLb / poundsPerCan / studentCount);
}

// "YYYY-MM-DD" plus n days.
function addDays(day, n) {
  var d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

// Everything the leaderboard page shows, from the log alone. Never stores a
// total. Names go through the full-names switch; emails are never included.
//   config: { startDay, endDay, goalLb, milestones, poundsPerCan, fullNames }
//   contests: [{ name, startDay, endDay, scope, filter, description }]
//   today: "YYYY-MM-DD" in the school's time zone
function buildLeaderboard(donations, roster, config, contests, today) {
  var lb = function (cans) { return Math.round(cans * config.poundsPerCan); };
  var named = function (rows) {
    return rows.map(function (r) {
      var copy = {};
      Object.keys(r).forEach(function (k) { if (k !== 'email') copy[k] = r[k]; });
      if (r.id) copy.name = displayName(r.name, config.fullNames);
      copy.lb = lb(r.total);
      return copy;
    });
  };
  var board = function (scope) {
    return standings(donations, roster, scope, config.startDay, config.endDay, 'all');
  };
  var inDrive = donations.filter(function (d) {
    return (!config.startDay || d.day >= config.startDay) && (!config.endDay || d.day <= config.endDay);
  });

  var school = board('school');
  var students = board('student');
  var studentCount = roster.filter(function (p) { return p.type === 'student'; }).length;

  return {
    ok: true,
    goalLb: config.goalLb,
    poundsPerCan: config.poundsPerCan,
    milestones: config.milestones,
    startDay: config.startDay,
    endDay: config.endDay,
    totalLb: lb(school.tonCans),
    facultyLb: lb(school.faculty),
    poolLb: lb(school.pool),
    pace: pace(inDrive, today, addDays(today, -1), config.endDay, config.goalLb, config.poundsPerCan),
    studentCount: studentCount,
    perStudent: perStudent(config.goalLb, config.poundsPerCan, studentCount),
    grades: named(board('grade')),
    advisories: named(board('advisory')),
    topStudents: named(topWithTies(students, 10)),
    students: named(students),
    faculty: named(topWithTies(board('faculty'), 1000)),
    staff: named(board('faculty')),
    contests: contests
      .filter(function (c) { return today >= c.startDay && today <= c.endDay; })
      .map(function (c) {
        var rows = standings(donations, roster, c.scope, c.startDay, c.endDay, c.filter);
        return { name: c.name, description: c.description, scope: c.scope, endDay: c.endDay,
                 rows: named(c.scope === 'student' || c.scope === 'faculty' ? topWithTies(rows, 10) : rows) };
      })
  };
}

// Find me: where one person stands, for the person card on the leaderboard.
// Works for people who haven't donated. Students are ranked in their
// advisory, grade and school; faculty on the faculty board. Never emails.
function personReport(donations, roster, config, id) {
  var person = findRow(roster, 'id', id);
  if (!person || (person.type !== 'student' && person.type !== 'faculty')) return null;
  var start = config.startDay;
  var end = config.endDay;
  var place = function (rows) {
    var me = findRow(rows, 'id', id);
    return { rank: me.rank, of: rows.length };
  };
  var lb = function (cans) { return Math.round(cans * config.poundsPerCan); };

  var report = { ok: true, id: person.id, name: displayName(person.name, config.fullNames), type: person.type,
                 grade: person.grade, advisory: person.advisory };
  var main;
  if (person.type === 'faculty') {
    main = standings(donations, roster, 'faculty', start, end, 'all');
    report.faculty = place(main);
  } else {
    main = standings(donations, roster, 'student', start, end, 'all');
    report.school = place(main);
    report.gradeRank = place(standings(donations, roster, 'student', start, end, String(person.grade)));
    var sameAdvisory = roster.filter(function (p) { return p.type === 'student' && p.advisory === person.advisory; });
    report.advisoryRank = place(standings(donations, sameAdvisory, 'student', start, end, 'all'));
  }
  var me = findRow(main, 'id', id);
  report.totalCans = me.total;
  report.totalLb = lb(me.total);
  report.moveUp = moveUp(main, id);
  report.history = donations
    .filter(function (d) { return d.personId === id && inWindow(d, start, end); })
    .sort(function (a, b) { return a.timestamp - b.timestamp || (a.day < b.day ? -1 : 1); })
    .map(function (d) { return { day: d.day, cans: d.cans }; });
  return report;
}

if (typeof module !== 'undefined') {
  module.exports = { assignRanks: assignRanks, standings: standings, topWithTies: topWithTies,
    moveUp: moveUp, countPassed: countPassed, displayName: displayName, pace: pace,
    perStudent: perStudent, daysBetween: daysBetween, findRow: findRow, addDays: addDays,
    buildLeaderboard: buildLeaderboard, personReport: personReport };
}
