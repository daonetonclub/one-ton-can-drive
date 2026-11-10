// Turning the registrar's export into Roster rows (Phase 5). Pure: no Sheets
// calls, so tests/import.test.js can check it with made-up rows. Real student
// data never goes into this file or the tests.
//
// Expected columns (any order): Preferred Name, Last Name, Current Grade,
// Advisor ("Last, First") and Email 1.

var REGISTRAR_COLUMNS = { first: 'preferred name', last: 'last name', grade: 'current grade',
                          advisor: 'advisor', email: 'email 1' };

// rows: the import tab's values, header row first.
// Returns { rows: Roster rows, problems: [text], counts: { students, advisories, byGrade } }.
// Problems never include names or emails, only row numbers.
function rosterFromRegistrar(rows) {
  var header = (rows[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
  var col = {};
  var problems = [];
  Object.keys(REGISTRAR_COLUMNS).forEach(function (k) {
    col[k] = header.indexOf(REGISTRAR_COLUMNS[k]);
    if (col[k] === -1) problems.push('Missing column: ' + REGISTRAR_COLUMNS[k]);
  });
  if (problems.length) return { rows: [], problems: problems, counts: null };

  var people = [];
  var seenEmails = {};
  rows.slice(1).forEach(function (row, i) {
    var line = i + 2;
    var cell = function (k) { return String(row[col[k]] == null ? '' : row[col[k]]).trim(); };
    var first = cell('first'), last = cell('last'), email = cell('email').toLowerCase();
    if (!first && !last && !email) return;                       // blank line
    var grade = Number((cell('grade').match(/\d+/) || [])[0]);
    var advisor = cell('advisor');
    if (!first || !last) problems.push('Row ' + line + ': missing a name');
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) problems.push('Row ' + line + ': missing or odd email');
    else if (seenEmails[email]) problems.push('Row ' + line + ': same email as row ' + seenEmails[email]);
    else seenEmails[email] = line;
    if ([9, 10, 11, 12].indexOf(grade) === -1) problems.push('Row ' + line + ': grade is not 9 to 12');
    if (!advisor) problems.push('Row ' + line + ': missing advisor');
    var parts = advisor.split(',');
    people.push({ first: first, last: last, email: email, grade: grade,
                  advisorLast: parts[0].trim(), advisorFirst: (parts[1] || '').trim(), advisor: advisor });
  });

  // Advisory name: advisor's last name, plus a first initial only when two
  // advisors share that last name (decision 25).
  var advisorsByLast = {};
  people.forEach(function (p) {
    advisorsByLast[p.advisorLast] = advisorsByLast[p.advisorLast] || {};
    advisorsByLast[p.advisorLast][p.advisor] = true;
  });
  var advisoryName = function (p) {
    var shared = Object.keys(advisorsByLast[p.advisorLast]).length > 1;
    return shared && p.advisorFirst ? p.advisorLast + ' ' + p.advisorFirst.charAt(0) + '.' : p.advisorLast;
  };

  // IDs in last-name order, so the same file always gives the same IDs.
  var key = function (s) { return s.toLowerCase(); };
  people.sort(function (a, b) {
    return key(a.last).localeCompare(key(b.last)) || key(a.first).localeCompare(key(b.first)) ||
      a.email.localeCompare(b.email);
  });

  var byGrade = {};
  var advisories = {};
  var out = people.map(function (p, i) {
    var advisory = advisoryName(p);
    byGrade[p.grade] = (byGrade[p.grade] || 0) + 1;
    advisories[advisory] = true;
    return ['S' + String(i + 1).padStart(3, '0'), p.first + ' ' + p.last, p.grade, advisory, p.email, 'student', ''];
  });
  return { rows: out, problems: problems,
           counts: { students: out.length, advisories: Object.keys(advisories).length, byGrade: byGrade } };
}

if (typeof module !== 'undefined') {
  module.exports = { rosterFromRegistrar: rosterFromRegistrar };
}
