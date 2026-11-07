// The donation page: grade -> advisory -> name -> cans -> done.
// Rules live in PLAN.md section 2. The server checks everything again, so
// nothing here is the only line of defence.

(function () {
  var API = window.ONE_TON.api;
  var ORGANIZER = window.ONE_TON.organizerEmail;
  var STORE_KEY = 'oneTon.me';
  var MAX_CANS = 50;
  var CONFIRM_AT = 20;
  var DIDNT_SAVE = "That didn't save. Your cans were not counted yet. Try again.";

  var roster = [];
  var picked = { grade: null, advisory: null };
  var me = null;        // { id, name, grade, advisory }
  var pending = null;   // { code, cans, personId } kept across retries
  var saving = false;
  var lastDone = null;

  var $ = function (id) { return document.getElementById(id); };

  // ---- Talking to the server ----

  // text/plain on purpose: JSON POSTs to Apps Script fail on CORS.
  function api(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify(body), redirect: 'follow' })
      .then(function (res) { return res.json(); });
  }

  // ---- Remembering who you are (this phone only) ----

  function loadMe() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }
  function saveMe(person) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(person)); } catch (e) { /* private mode: just don't remember */ }
  }
  function forgetMe() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nothing to forget */ }
  }

  // ---- Screens ----

  function show(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== 'screen-' + name; });
    window.scrollTo(0, 0);
  }

  function button(label, onClick, extra) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (extra) {
      var span = document.createElement('span');
      span.textContent = extra;
      b.appendChild(span);
    }
    b.addEventListener('click', onClick);
    return b;
  }

  function unique(list) {
    return list.filter(function (v, i) { return v !== '' && list.indexOf(v) === i; });
  }

  var GRADE_NAMES = { 9: 'Freshman', 10: 'Sophomore', 11: 'Junior', 12: 'Senior' };

  function showGrades() {
    var list = $('grade-list');
    list.innerHTML = '';
    var grades = unique(roster.map(function (p) { return p.grade; })).sort(function (a, b) { return a - b; });
    grades.forEach(function (g) {
      list.appendChild(button(String(g), function () { picked.grade = g; showAdvisories(); }, GRADE_NAMES[g] || ''));
    });
    show('grade');
  }

  function showAdvisories() {
    var list = $('advisory-list');
    list.innerHTML = '';
    unique(roster.filter(function (p) { return p.grade === picked.grade; })
      .map(function (p) { return p.advisory; })).sort()
      .forEach(function (a) {
        list.appendChild(button(a, function () { picked.advisory = a; showNames(); }));
      });
    show('advisory');
  }

  function showNames() {
    $('name-search').value = '';
    drawNames('');
    show('name');
  }

  function drawNames(search) {
    var list = $('name-list');
    list.innerHTML = '';
    var q = search.trim().toLowerCase();
    roster.filter(function (p) {
      return p.grade === picked.grade && p.advisory === picked.advisory &&
        (!q || p.name.toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (p) {
        list.appendChild(button(p.name, function () { choose(p, false); }));
      });
  }

  function choose(person, remembered) {
    me = { id: person.id, name: person.name, grade: person.grade, advisory: person.advisory };
    pending = null;
    $('cans-who').textContent = me.name + (me.advisory ? ' · ' + me.advisory + ' advisory' : '');
    $('cans').value = '';
    hideMessage();
    $('confirm').hidden = true;
    $('remembered').hidden = !remembered;
    show('cans');
  }

  // ---- The cans box ----
  // Never rewritten while typing (a box that rewrites itself feels broken).
  // Tidied only when you leave it.

  function tidyCans() {
    var box = $('cans');
    box.value = box.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  }

  function currentCans() {
    var n = parseInt($('cans').value.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function setCans(n) {
    $('cans').value = n > 0 ? String(n) : '';
    hideMessage();
    $('confirm').hidden = true;
  }

  function showMessage(text) {
    var m = $('cans-message');
    m.textContent = text;
    m.hidden = false;
  }
  function hideMessage() { $('cans-message').hidden = true; }

  // Checks before saving. Returns the number of cans, or null if blocked.
  function checkedCans() {
    var text = $('cans').value.trim();
    if (text === '') { showMessage('How many cans?'); return null; }
    if (!/^\d+$/.test(text)) { showMessage('Please enter a whole number of cans.'); return null; }
    var n = Number(text);
    if (n < 1) { showMessage('Please enter at least 1 can.'); return null; }
    if (n > MAX_CANS) { showMessage('50 is the most you can log at once. Log 50 now and the rest as a second entry.'); return null; }
    return n;
  }

  function submit() {
    if (saving) return;
    tidyCans();
    hideMessage();
    var n = checkedCans();
    if (n === null) return;
    if (n >= CONFIRM_AT) {
      $('confirm-text').textContent = n + ' cans, nice. Just checking, is that right?';
      $('confirm').hidden = false;
      $('submit').hidden = true;
      return;
    }
    save(n);
  }

  function newCode() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function save(n) {
    if (saving) return;
    saving = true;
    $('submit').disabled = true;
    $('submit').textContent = 'Saving…';
    // A retry of the same cans for the same person reuses the code, so if the
    // first try did reach the Sheet, the server won't log it again.
    if (!pending || pending.cans !== n || pending.personId !== me.id) {
      pending = { code: newCode(), cans: n, personId: me.id };
    }
    api({ action: 'donate', person: me.id, cans: n, request: pending.code })
      .then(function (r) {
        if (r.ok) {
          pending = null;
          saveMe(me);
          showDone(r);
        } else if (r.error === 'not_started' || r.error === 'ended') {
          checkOpen();
        } else if (r.error === 'unknown_person') {
          forgetMe();
          me = null;
          showGrades();
        } else if (r.error === 'busy' || r.error === 'server') {
          showMessage(DIDNT_SAVE);
        } else {
          pending = null;
          showMessage(r.message || DIDNT_SAVE);
        }
      })
      .catch(function () { showMessage(DIDNT_SAVE); })
      .then(function () {
        saving = false;
        $('submit').disabled = false;
        $('submit').textContent = 'Count my cans';
        $('submit').hidden = false;
        $('confirm').hidden = true;
      });
  }

  // ---- Done ----

  function showDone(r) {
    lastDone = { cans: r.cans, name: r.name, at: new Date() };
    var name = /\.$/.test(r.name) ? r.name : r.name + '.';
    $('done-summary').textContent = r.cans + (r.cans === 1 ? ' can' : ' cans') + ' counted for ' + name +
      ' They are already on the leaderboard.';
    var facts = [];
    if (r.before && r.after) {
      if (r.before.total === 0) facts.push("You're on the board at #" + r.after.rank + '.');
      else if (r.after.rank < r.before.rank) facts.push('You moved from #' + r.before.rank + ' to #' + r.after.rank + '.');
      else facts.push("You're at #" + r.after.rank + '.');
    }
    if (r.passed > 0) facts.push('You passed ' + r.passed + (r.passed === 1 ? ' person.' : ' people.'));
    if (r.advisory) {
      var lb = Math.round(r.advisory.total * (r.poundsPerCan || 1));
      facts.push(r.advisory.name + ' advisory is #' + r.advisory.rank + ' with ' + lb + ' lb. ' +
        r.advisory.donors + ' of ' + r.advisory.size + ' have donated.');
    }
    var list = $('done-facts');
    list.innerHTML = '';
    facts.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f;
      list.appendChild(li);
    });
    $('report').href = 'mailto:' + ORGANIZER + '?subject=' + encodeURIComponent('Something wrong with my entry') +
      '&body=' + encodeURIComponent('Name: ' + r.name + '\nCans: ' + r.cans + '\nTime: ' +
      lastDone.at.toLocaleString() + '\n\nWhat went wrong:\n');
    show('done');
  }

  // ---- Is the drive open? ----

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function longDate(day) {
    var parts = day.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  // Returns true if the form should show.
  function applyStatus(status) {
    var today = todayKey();
    if (status.startDay && today < status.startDay) {
      $('closed-title').textContent = 'The drive starts ' + longDate(status.startDay) + '.';
      $('closed-text').textContent = 'See you then!';
      show('closed');
      return false;
    }
    if (status.endDay && today > status.endDay) {
      $('closed-title').textContent = 'The drive is over. Thank you!';
      $('closed-text').textContent = 'We collected ' + status.totalLb + ' lb.';
      show('closed');
      return false;
    }
    return true;
  }

  function checkOpen() {
    return api({ action: 'leaderboard' }).then(applyStatus);
  }

  // ---- Start ----

  function start() {
    $('not-listed').href = 'mailto:' + ORGANIZER + '?subject=' + encodeURIComponent("I'm not on the One Ton list");
    Promise.all([api({ action: 'roster' }), api({ action: 'leaderboard' })])
      .then(function (replies) {
        roster = (replies[0].people || []).filter(function (p) { return p.grade !== '' && p.advisory; });
        if (!applyStatus(replies[1])) return;
        var remembered = loadMe();
        var still = remembered && roster.filter(function (p) { return p.id === remembered.id; })[0];
        if (still) choose(still, true);
        else { forgetMe(); showGrades(); }
      })
      .catch(function () { show('error'); });
  }

  // ---- Wiring ----

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    switch (target.getAttribute('data-action')) {
      case 'reload': location.reload(); break;
      case 'back-to-grade': showGrades(); break;
      case 'back-to-advisory': showAdvisories(); break;
      case 'minus': tidyCans(); setCans(Math.max(currentCans() - 1, 1)); break;
      case 'plus': tidyCans(); setCans(Math.min(currentCans() + 1, MAX_CANS)); break;
      case 'submit': submit(); break;
      case 'confirm-yes': save(currentCans()); break;
      case 'confirm-fix':
        $('confirm').hidden = true;
        $('submit').hidden = false;
        $('cans').focus();
        $('cans').select();
        break;
      case 'not-me': forgetMe(); me = null; showGrades(); break;
      case 'log-more': choose(me, true); break;
    }
  });

  [1, 5, 10, 15, 20].forEach(function (n) {
    $('quick').appendChild(button(String(n), function () { setCans(n); }));
  });
  $('cans').addEventListener('blur', tidyCans);
  $('cans').addEventListener('input', function () { hideMessage(); $('confirm').hidden = true; $('submit').hidden = false; });
  $('cans').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  $('name-search').addEventListener('input', function (e) { drawNames(e.target.value); });

  start();
})();
