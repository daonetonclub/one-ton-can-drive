// One-time setup. Run setupSheet from the Apps Script editor once.
// It only creates tabs that don't exist yet, so running it again never
// erases anything.

// Obviously fake people for testing. Real students go in by hand in Phase 5,
// in the Sheet only, never in this file.
var FAKE_ROSTER = [
  ['S001', 'Avery Testwell', 9, 'Maple', 's001@example.com', 'student'],
  ['S002', 'Jordan Mockley', 9, 'Maple', 's002@example.com', 'student'],
  ['S003', 'Riley Sampleton', 9, 'Birch', 's003@example.com', 'student'],
  ['S004', 'Casey Demoson', 9, 'Birch', 's004@example.com', 'student'],
  ['S005', 'Morgan Fakely', 10, 'Cedar', 's005@example.com', 'student'],
  ['S006', 'Quinn Placeholder', 10, 'Cedar', 's006@example.com', 'student'],
  ['S007', 'Taylor Testwell', 10, 'Pine', 's007@example.com', 'student'],
  ['S008', 'Jamie Exampleton', 10, 'Pine', 's008@example.com', 'student'],
  ['S009', 'Drew Mockley', 11, 'Oak', 's009@example.com', 'student'],
  ['S010', 'Sam Sampleton', 11, 'Oak', 's010@example.com', 'student'],
  ['S011', 'Alex Demoson', 11, 'Elm', 's011@example.com', 'student'],
  ['S012', 'Robin Fakely', 11, 'Elm', 's012@example.com', 'student'],
  ['S013', 'Charlie Placeholder', 12, 'Willow', 's013@example.com', 'student'],
  ['S014', 'Parker Exampleton', 12, 'Willow', 's014@example.com', 'student'],
  ['S015', 'Reese Testwell', 12, 'Spruce', 's015@example.com', 'student'],
  ['S016', 'Skyler Mockley', 12, 'Spruce', 's016@example.com', 'student'],
  ['F001', 'Pat Teacherton', '', '', 'f001@example.com', 'faculty'],
  ['F002', 'Lee Staffwell', '', '', 'f002@example.com', 'faculty'],
  ['F003', 'Dana Coachman', '', '', 'f003@example.com', 'faculty'],
  ['F004', 'Kim Librarian', '', '', 'f004@example.com', 'faculty']
];

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  // Show times in the school's time zone, the same one the program uses.
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());

  // A new Sheet starts with one empty tab; reuse it as Roster.
  var first = ss.getSheets()[0];
  if (!ss.getSheetByName(TAB.roster) && first.getLastRow() === 0) first.setName(TAB.roster);

  var roster = makeTab(ss, TAB.roster, ROSTER_COLUMNS);
  if (roster.getLastRow() === 1) {
    var rows = FAKE_ROSTER.map(function (r) { return r.concat(['']); });
    roster.getRange(2, 1, rows.length, ROSTER_COLUMNS.length).setValues(rows);
  }

  var donations = makeTab(ss, TAB.donations, DONATION_COLUMNS);
  donations.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  if (donations.getConditionalFormatRules().length === 0) {
    // Flagged and not yet reviewed: red. This is the organizer view.
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($G2<>"", $H2<>TRUE)')
      .setBackground('#f4c7c3')
      .setRanges([donations.getRange('A2:H')])
      .build();
    donations.setConditionalFormatRules([rule]);
  }

  var config = makeTab(ss, TAB.config, ['key', 'value', 'what it does']);
  if (config.getLastRow() === 1) {
    config.getRange(2, 1, 9, 3).setValues([
      ['start_date', new Date(), 'First day donations are accepted. TESTING: set to the setup day. Change to 2027-01-19 in Phase 6.'],
      ['end_date', new Date(2027, 2, 4), 'Last day donations are accepted. Change this cell to extend the drive.'],
      ['goal_lb', 2000, 'The goal, in pounds.'],
      ['milestones', '500,1000,1500,2000', 'Marks on the tracker, in pounds.'],
      ['pounds_per_can', 1, 'Correct after the food bank weighs the first pickup.'],
      ['full_names', false, 'FALSE shows "Ben M." Set TRUE only after written approval.'],
      ['first_email', false, 'TRUE sends the one-time first-donation email. Only after the technology office approves.'],
      ['bin_locations', '', 'One bin per line (Ctrl+Enter for a new line). Detail after a dash: Library entrance - by the front desk'],
      ['food_bank', '', 'The food bank partner\'s name, shown on How it works. Blank until the club picks one.']
    ]);
    config.getRange('B2:B3').setNumberFormat('yyyy-mm-dd');
    config.getRange('B5').setNumberFormat('@').setValue('500, 1000, 1500, 2000');
  }

  makeTab(ss, TAB.contests, CONTEST_COLUMNS);
}

// "reviewed" gets a checkbox only on rows that hold a donation. Checkboxes
// on empty rows make Google treat those rows as used.
function reviewedCheckboxes(donations, firstRow, count) {
  if (count < 1) return;
  var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  donations.getRange(firstRow, 8, count, 1).setDataValidation(rule);
}

// Repair for the first setup, which put checkboxes on about 1,000 empty
// rows. Moves every donation row up to start at row 2,
// keeps all of them, and sets the Sheet to the school's time zone. Safe to run
// more than once.
function tidyDonations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  var donations = tab(TAB.donations);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var height = donations.getMaxRows() - 1;
    if (height < 1) return;
    var range = donations.getRange(2, 1, height, DONATION_COLUMNS.length);
    var kept = range.getValues().filter(function (row) {
      return row.slice(0, 7).some(function (cell) { return cell !== ''; });
    });
    // Rules first, then values, so emptied checkbox cells end up truly empty.
    range.clearDataValidations();
    range.clearContent();
    if (kept.length) donations.getRange(2, 1, kept.length, DONATION_COLUMNS.length).setValues(kept);
    reviewedCheckboxes(donations, 2, kept.length);
    SpreadsheetApp.flush();
    console.log('Kept ' + kept.length + ' donation rows, starting at row 2.');
  } finally {
    lock.releaseLock();
  }
}

// One-time repair for two Config cells the first setup got wrong:
//   milestones: Sheets read "500,1000,1500,2000" as one big number.
//   end_date: written while the Sheet was on Pacific time, it became
//   March 3 when the Sheet moved to Eastern.
// Only touches those two cells, and only if they still hold the bad values.
function fixConfigCells() {
  var config = tab(TAB.config);
  var rows = config.getRange(2, 1, config.getLastRow() - 1, 2).getValues();
  rows.forEach(function (row, i) {
    var cell = config.getRange(i + 2, 2);
    if (row[0] === 'milestones' && typeof row[1] === 'number') {
      cell.setNumberFormat('@').setValue('500, 1000, 1500, 2000');
      console.log('Fixed milestones.');
    }
    if (row[0] === 'end_date' && row[1] instanceof Date && dayKey(row[1]) === '2027-03-03') {
      cell.setValue(new Date(2027, 2, 4)).setNumberFormat('yyyy-mm-dd');
      console.log('Fixed end_date: now ' + dayKey(cell.getValue()) + '.');
    }
  });
  CacheService.getScriptCache().remove(CACHE_KEY);
}

// Phase 5, step 1. Moves the fake test rows (donations, roster, contests)
// into _archive_test_* tabs and empties them from the live tabs. Nothing is
// deleted. Refuses to run if the Roster holds anyone who isn't a fake
// @example.com person, so it can never archive real students.
function archiveTestData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roster = tab(TAB.roster);
  var real = bodyRows(roster).filter(function (row) {
    return row[0] !== '' && !/@example\.com$/i.test(String(row[4]).trim());
  });
  if (real.length) throw new Error('Stopped: the Roster has ' + real.length + ' rows that are not fake test people.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    [TAB.donations, TAB.roster, TAB.contests].forEach(function (name) {
      var live = tab(name);
      var rows = bodyRows(live).filter(function (row) {
        return row.slice(0, 7).some(function (cell) { return cell !== ''; });
      });
      var archiveName = '_archive_test_' + name.toLowerCase();
      var archive = ss.getSheetByName(archiveName) || ss.insertSheet(archiveName);
      if (archive.getLastRow() === 0) {
        archive.getRange(1, 1, 1, live.getLastColumn()).setValues(live.getRange(1, 1, 1, live.getLastColumn()).getValues());
      }
      if (rows.length) {
        archive.getRange(archive.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
        var body = live.getRange(2, 1, live.getMaxRows() - 1, live.getMaxColumns());
        body.clearDataValidations();
        body.clearContent();
      }
      console.log(name + ': moved ' + rows.length + ' rows to ' + archiveName + '.');
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove(CACHE_KEY);
}

// Phase 5, step 3. Reads the registrar's export from a tab whose name starts
// with "_import_registrar" and writes it into the empty Roster. Logs counts
// and row-numbered problems only, never names or emails. Refuses to run if
// the Roster isn't empty or if the file has problems.
function importRoster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var source = ss.getSheets().filter(function (sh) { return /^_import_registrar/.test(sh.getName()); })[0];
  if (!source) throw new Error('Stopped: no tab named _import_registrar... Import the CSV first.');
  var roster = tab(TAB.roster);
  if (bodyRows(roster).some(function (row) { return row[0] !== ''; })) {
    throw new Error('Stopped: the Roster is not empty. Run archiveTestData first.');
  }
  var result = rosterFromRegistrar(source.getDataRange().getValues());
  if (result.problems.length) {
    result.problems.forEach(function (p) { console.log(p); });
    throw new Error('Stopped: ' + result.problems.length + ' problems in the file (listed above). Nothing was written.');
  }
  roster.getRange(2, 1, result.rows.length, ROSTER_COLUMNS.length).setValues(result.rows);
  CacheService.getScriptCache().remove(CACHE_KEY);
  console.log('Loaded ' + result.counts.students + ' students in ' + result.counts.advisories +
    ' advisories. By grade: ' + JSON.stringify(result.counts.byGrade));
}

function makeTab(ss, name, columns) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
