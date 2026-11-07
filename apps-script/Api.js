// The web address the website talks to. Three actions only:
//   roster       -> getRoster()
//   leaderboard  -> getLeaderboard()
//   donate       -> submitDonation(personId, cans, requestId)
//   person       -> getPerson(personId), for Find me
// The browser sends POST bodies as text/plain and they are parsed here, because
// POSTing JSON to an Apps Script web app fails on CORS. GET works too, so a
// donation can be tested from a plain link.

var CACHE_KEY = 'leaderboard';
var CACHE_SECONDS = 300;
var REQUEST_SECONDS = 600;  // how long a one-time save code is remembered

function doGet(e) {
  return respond(route(e && e.parameter ? e.parameter : {}));
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e && e.postData ? e.postData.contents : '{}');
  } catch (err) {
    return respond({ ok: false, error: 'bad_request', message: 'Could not read the request.' });
  }
  return respond(route(body));
}

function route(params) {
  try {
    switch (params.action) {
      case 'roster': return getRoster();
      case 'leaderboard': return getLeaderboard();
      case 'donate': return submitDonation(params.person, params.cans, params.request);
      case 'person': return getPerson(params.person);
      default: return { ok: false, error: 'bad_request', message: 'Unknown action.' };
    }
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'server', message: 'Something went wrong. Try again.' };
  }
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Roster for the name picker: id, name, grade and advisory only. No emails,
// ever. Names follow the full-names switch.
function getRoster() {
  var config = readConfig();
  return {
    ok: true,
    people: readRoster().map(function (p) {
      return { id: p.id, name: displayName(p.name, config.fullNames), grade: p.grade, advisory: p.advisory };
    })
  };
}

// Find me: one person's ranks, history and move-up line. No emails.
function getPerson(personId) {
  var report = personReport(readDonations(), readRoster(), readConfig(), String(personId || '').trim());
  return report || { ok: false, error: 'unknown_person', message: 'We could not find that name.' };
}

// Where a person and their advisory stand, for the success screen.
function snapshot(donations, roster, person, config) {
  var scope = person.type === 'faculty' ? 'faculty' : 'student';
  var board = standings(donations, roster, scope, config.startDay, config.endDay, 'all');
  var me = findRow(board, 'id', person.id);
  var advisory = null;
  if (person.type === 'student') {
    var advisories = standings(donations, roster, 'advisory', config.startDay, config.endDay, 'all');
    advisory = findRow(advisories, 'name', person.advisory);
  }
  return { board: board, me: me, advisory: advisory };
}

// requestId is a one-time code the page makes for each save. If the same code
// arrives again (a retry after a dropped connection), nothing new is written
// and the first answer is sent back, so the cans are never logged twice.
function submitDonation(personId, cansValue, requestId) {
  var config = readConfig();
  var open = checkOpen(dayKey(new Date()), config.startDay, config.endDay);
  if (!open.ok) return open;

  var check = checkCans(cansValue);
  if (!check.ok) return check;

  var roster = readRoster();
  var person = findRow(roster, 'id', String(personId || '').trim());
  if (!person || (person.type !== 'student' && person.type !== 'faculty')) {
    return { ok: false, error: 'unknown_person', message: 'We could not find that name. Pick it from the list again.' };
  }

  // The flag looks at this person's recent entries. It is a soft check, so it
  // is read before the lock.
  var now = new Date();
  var recent = readDonations()
    .filter(function (d) { return d.personId === person.id; })
    .map(function (d) { return d.timestamp; });
  var flag = flagReason(check.cans, now.getTime(), recent);

  // Only the write is locked, so a crowd at an assembly moves through quickly.
  var cache = CacheService.getScriptCache();
  var requestKey = /^[A-Za-z0-9-]{8,64}$/.test(String(requestId || '')) ? 'request:' + requestId : '';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { ok: false, error: 'busy', message: "That didn't save. Your cans were not counted yet. Try again." };
  }
  try {
    var seen = requestKey ? cache.get(requestKey) : null;
    if (seen) return seen === 'saved' ? { ok: true, cans: check.cans, duplicate: true } : JSON.parse(seen);
    var sheet = tab(TAB.donations);
    var row = nextDonationRow(sheet);
    sheet.getRange(row, 1, 1, DONATION_COLUMNS.length)
      .setValues([[now, person.id, person.name, check.cans, person.type, '', flag, false]]);
    reviewedCheckboxes(sheet, row, 1);
    SpreadsheetApp.flush();
    if (requestKey) cache.put(requestKey, 'saved', REQUEST_SECONDS);
  } finally {
    lock.releaseLock();
  }
  cache.remove(CACHE_KEY);

  // "After" is the log as it now stands. "Before" is exactly that log without
  // this donation, so the two numbers always compare the same moment.
  var afterLog = readDonations();
  var mine = -1;
  afterLog.forEach(function (d, i) {
    if (d.personId !== person.id || d.cans !== check.cans) return;
    if (mine === -1 || Math.abs(d.timestamp - now.getTime()) < Math.abs(afterLog[mine].timestamp - now.getTime())) mine = i;
  });
  var beforeLog = afterLog.filter(function (d, i) { return i !== mine; });
  var before = snapshot(beforeLog, roster, person, config);
  var after = snapshot(afterLog, roster, person, config);

  var result = {
    ok: true,
    cans: check.cans,
    poundsPerCan: config.poundsPerCan,
    name: displayName(person.name, config.fullNames),
    before: { rank: before.me.rank, total: before.me.total },
    after: { rank: after.me.rank, total: after.me.total },
    passed: countPassed(before.board, after.board, person.id),
    advisory: after.advisory
      ? { name: after.advisory.name, rank: after.advisory.rank, total: after.advisory.total,
          donors: after.advisory.donors, size: after.advisory.size }
      : null
  };
  if (requestKey) cache.put(requestKey, JSON.stringify(result), REQUEST_SECONDS);
  return result;
}

// Every board, computed from the Donations tab and cached for five minutes.
// The math is in buildLeaderboard (Standings.js), so it can be tested offline.
function getLeaderboard() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var now = new Date();
  var result = buildLeaderboard(readDonations(), readRoster(), readConfig(), readContests(), dayKey(now));
  result.asOf = now.toISOString();
  cache.put(CACHE_KEY, JSON.stringify(result), CACHE_SECONDS);
  return result;
}
