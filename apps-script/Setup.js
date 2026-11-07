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
  reviewedCheckboxes(donations);
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
    config.getRange(2, 1, 8, 3).setValues([
      ['start_date', new Date(), 'First day donations are accepted. TESTING: set to the setup day. Change to 2027-01-19 in Phase 6.'],
      ['end_date', new Date(2027, 2, 4), 'Last day donations are accepted. Change this cell to extend the drive.'],
      ['goal_lb', 2000, 'The goal, in pounds.'],
      ['milestones', '500,1000,1500,2000', 'Marks on the tracker, in pounds.'],
      ['pounds_per_can', 1, 'Correct after the food bank weighs the first pickup.'],
      ['full_names', false, 'FALSE shows "Ben M." Set TRUE only after written approval.'],
      ['first_email', false, 'TRUE sends the one-time first-donation email. Only after the technology office approves.'],
      ['bin_locations', '', 'To be decided with facilities in December.']
    ]);
    config.getRange('B2:B3').setNumberFormat('yyyy-mm-dd');
  }

  makeTab(ss, TAB.contests, CONTEST_COLUMNS);
}

// "reviewed" shows a checkbox on every donation row. This uses a rule rather
// than filling the column with unticked boxes: filled boxes count as used
// rows, and new donations would land below row 1,000.
function reviewedCheckboxes(donations) {
  var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  donations.getRange('H2:H').setDataValidation(rule);
}

// One-time repair for the first setup, which filled the reviewed column with
// about 1,000 empty checkboxes. Moves every donation row up to start at row 2,
// keeps all of them, and sets the Sheet to the school's time zone. Safe to run
// more than once.
function tidyDonations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  var donations = tab(TAB.donations);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var last = donations.getLastRow();
    if (last < 2) return;
    var range = donations.getRange(2, 1, last - 1, DONATION_COLUMNS.length);
    var kept = range.getValues().filter(function (row) {
      return row.slice(0, 7).some(function (cell) { return cell !== ''; });
    });
    range.clearContent();
    range.clearDataValidations();
    if (kept.length) donations.getRange(2, 1, kept.length, DONATION_COLUMNS.length).setValues(kept);
    reviewedCheckboxes(donations);
    SpreadsheetApp.flush();
    console.log('Kept ' + kept.length + ' donation rows, starting at row 2.');
  } finally {
    lock.releaseLock();
  }
}

function makeTab(ss, name, columns) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
