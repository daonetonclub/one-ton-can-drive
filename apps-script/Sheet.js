// Reading the private Sheet: Config, Contests, Roster and Donations.
// Every setting comes from the Sheet; nothing about the drive is hard-coded.

var TAB = { roster: 'Roster', donations: 'Donations', config: 'Config', contests: 'Contests' };

var ROSTER_COLUMNS = ['id', 'name', 'grade', 'advisory', 'email', 'type', 'first_emailed'];
var DONATION_COLUMNS = ['timestamp', 'person_id', 'name', 'cans', 'source', 'note', 'flag', 'reviewed'];
var CONTEST_COLUMNS = ['name', 'start', 'end', 'scope', 'filter', 'description', 'prize'];

function spreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function tab(name) {
  var sheet = spreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Missing tab: ' + name + '. Run setupSheet first.');
  return sheet;
}

// All rows under the header row, as arrays.
function bodyRows(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
}

// The row under the last donation, found by its timestamp. Not appendRow:
// checkboxes and formatting can make Google treat empty rows as used, and
// appendRow would then write far below the real log.
function nextDonationRow(sheet) {
  var height = sheet.getMaxRows() - 1;
  var next = 2;
  if (height >= 1) {
    var times = sheet.getRange(2, 1, height, 1).getValues();
    for (var i = times.length - 1; i >= 0; i--) {
      if (times[i][0] !== '') { next = i + 3; break; }
    }
  }
  // Out of rows at the bottom of the tab: add some more.
  if (next > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  return next;
}

function dayKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function asDay(value) {
  if (value instanceof Date) return dayKey(value);
  return String(value || '').trim();
}

// Config is two columns: key, value.
function readConfig() {
  var config = {};
  bodyRows(tab(TAB.config)).forEach(function (row) {
    var key = String(row[0]).trim();
    if (key) config[key] = row[1];
  });
  return {
    startDay: asDay(config.start_date),
    endDay: asDay(config.end_date),
    goalLb: Number(config.goal_lb) || 0,
    milestones: String(config.milestones || '').split(',')
      .map(function (m) { return Number(String(m).trim()); })
      .filter(function (m) { return m > 0; }),
    poundsPerCan: Number(config.pounds_per_can) || 1,
    fullNames: config.full_names === true || String(config.full_names).toUpperCase() === 'TRUE',
    firstEmail: config.first_email === true || String(config.first_email).toUpperCase() === 'TRUE',
    binLocations: String(config.bin_locations || '')
  };
}

function readContests() {
  return bodyRows(tab(TAB.contests)).map(function (row) {
    return { name: String(row[0]).trim(), startDay: asDay(row[1]), endDay: asDay(row[2]),
             scope: String(row[3]).trim().toLowerCase(), filter: String(row[4]).trim(),
             description: String(row[5] || '').trim(), prize: String(row[6] || '').trim() };
  }).filter(function (c) { return c.name && c.startDay && c.endDay; });
}

// Full roster, emails included. Server-side only: never return this as is.
function readRoster() {
  return bodyRows(tab(TAB.roster)).map(function (row, i) {
    return { row: i + 2, id: String(row[0]).trim(), name: String(row[1]).trim(),
             grade: row[2] === '' ? '' : Number(row[2]), advisory: String(row[3]).trim(),
             email: String(row[4]).trim(), type: String(row[5]).trim().toLowerCase(),
             firstEmailed: row[6] };
  }).filter(function (p) { return p.id && p.name; });
}

// Every donation row. A row zeroed or blanked by hand simply counts as nothing.
function readDonations() {
  return bodyRows(tab(TAB.donations)).map(function (row) {
    var time = row[0] instanceof Date ? row[0] : new Date(row[0]);
    return { timestamp: time.getTime(), day: dayKey(time), personId: String(row[1]).trim(),
             cans: Number(row[3]) || 0, source: String(row[4]).trim().toLowerCase() };
  }).filter(function (d) {
    // Pool rows are added by hand and may have no person.
    return (d.personId || d.source === 'pool') && d.cans > 0 && !isNaN(d.timestamp);
  });
}
