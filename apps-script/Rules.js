// Pure checks for a donation. No Sheets calls, so the Node tests can run them.

var MAX_CANS = 50;          // hard cap per entry (PLAN.md section 2)
var FLAG_CANS = 25;         // silently flagged for review at this size
var RAPID_ENTRIES = 3;      // this many entries from one person...
var RAPID_MINUTES = 10;     // ...within this many minutes is flagged

// Cans must be a whole number from 1 to 50. Text, decimals, 0 and empty are
// refused rather than guessed at.
function checkCans(value) {
  var text = String(value == null ? '' : value).trim();
  if (text === '') return { ok: false, error: 'empty', message: 'How many cans?' };
  if (!/^\d+$/.test(text)) return { ok: false, error: 'bad_cans', message: 'Please enter a whole number of cans.' };
  var cans = Number(text);
  if (cans < 1) return { ok: false, error: 'bad_cans', message: 'Please enter at least 1 can.' };
  if (cans > MAX_CANS) {
    return { ok: false, error: 'too_many',
             message: '50 is the most you can log at once. Log 50 now and the rest as a second entry.' };
  }
  return { ok: true, cans: cans };
}

// Is today inside the drive? All three are "YYYY-MM-DD".
function checkOpen(today, startDay, endDay) {
  if (startDay && today < startDay) return { ok: false, error: 'not_started', message: 'The drive has not started yet.' };
  if (endDay && today > endDay) return { ok: false, error: 'ended', message: 'The drive is over. Thank you!' };
  return { ok: true };
}

// Why a new entry should be flagged, or "" if it shouldn't.
// recentTimes: this person's earlier entry times (ms) in the last few minutes.
function flagReason(cans, nowMs, recentTimes) {
  if (cans >= FLAG_CANS) return '25+ cans';
  var windowStart = nowMs - RAPID_MINUTES * 60000;
  var recent = recentTimes.filter(function (t) { return t >= windowStart; }).length;
  if (recent + 1 >= RAPID_ENTRIES) return 'rapid entries';
  return '';
}

if (typeof module !== 'undefined') {
  module.exports = { checkCans: checkCans, checkOpen: checkOpen, flagReason: flagReason,
    MAX_CANS: MAX_CANS, FLAG_CANS: FLAG_CANS };
}
