// The public leaderboard. Read-only. Every number comes from the server,
// which computes it from the Donations tab (PLAN.md section 3).

(function () {
  var API = window.ONE_TON.api;
  var STORE_KEY = 'oneTon.me';   // set by the donation page on this phone
  var REFRESH_MS = 2 * 60 * 1000;
  // ?tv=1 is the hallway screen: one big number, screenshotted for the
  // Learning Commons slideshow. It never claims to update live.
  var TV = /[?&]tv=1(&|$)/.test(location.search);

  var data = null;
  var tab = 'grades';
  var route = [];       // drill-down path, e.g. [{ grade: 9 }, { advisory: 'Maple' }]

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  function api(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify(body), redirect: 'follow' })
      .then(function (res) { return res.json(); });
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dayBefore(day) {
    var p = day.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function longDate(day) {
    var p = day.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Standard competition ranking within a sub-list (1, 2, 2, 4).
  function rerank(rows) {
    var sorted = rows.slice().sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
    var rank = 0;
    return sorted.map(function (r, i) {
      if (i === 0 || r.total !== sorted[i - 1].total) rank = i + 1;
      var copy = Object.assign({}, r);
      copy.rank = rank;
      return copy;
    });
  }

  // ---- Tracker, pace line, "everyone brings five" ----

  function drawTracker() {
    var goal = data.goalLb || 1;
    $('total').textContent = fmt(data.totalLb) + ' lb';
    $('goal').textContent = 'of ' + fmt(goal) + ' lb';

    // The bar keeps going past the goal: the scale grows to fit the total.
    var scale = Math.max(goal, data.totalLb);
    $('bar-fill').style.width = (100 * data.totalLb / scale) + '%';
    $('bar').classList.toggle('over', data.totalLb > goal);
    var marks = $('marks');
    marks.innerHTML = '';
    (data.milestones || []).forEach(function (m) {
      var tick = document.createElement('span');
      tick.className = 'mark' + (data.totalLb >= m ? ' reached' : '');
      tick.style.left = (100 * m / scale) + '%';
      tick.textContent = fmt(m);
      marks.appendChild(tick);
    });

    var today = todayKey();
    var pace = $('pace');
    pace.classList.remove('behind');
    if (data.startDay && today < data.startDay) {
      pace.textContent = 'The drive starts ' + longDate(data.startDay) + '.';
    } else if (data.totalLb >= goal) {
      pace.textContent = 'We hit the ton!';
    } else {
      var text = fmt(data.pace.neededPerDay) + ' lb a day from here reaches ' + fmt(goal) + ' lb by ' +
        longDate(data.endDay) + '.';
      // On the first day there is no "yesterday" yet.
      if (!data.startDay || dayBefore(today) >= data.startDay) {
        text += ' Yesterday the school brought in ' + fmt(data.pace.yesterdayLb) + ' lb.';
        if (data.pace.behind) pace.classList.add('behind');
      }
      pace.textContent = text;
    }

    $('five').textContent = 'There are ' + fmt(data.studentCount) + ' of us. If everyone brings ' +
      data.perStudent + ', we hit the ton.';
    $('disclosure').textContent = data.facultyLb > 0
      ? 'Includes ' + fmt(data.facultyLb) + ' lb from faculty and staff.' : '';
  }

  // ---- Tabs and boards ----

  function tabs() {
    var list = [
      { key: 'grades', label: 'Grades' },
      { key: 'advisories', label: 'Advisories' },
      { key: 'students', label: 'Top students' },
      { key: 'faculty', label: 'Faculty' },
      { key: 'findme', label: 'Find me' }
    ];
    (data.contests || []).forEach(function (c, i) { list.push({ key: 'contest' + i, label: c.name }); });
    return list;
  }

  function drawTabs() {
    var nav = $('tabs');
    nav.innerHTML = '';
    var all = tabs();
    if (!all.some(function (t) { return t.key === tab; })) { tab = 'grades'; route = []; }
    all.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.key === tab));
      b.textContent = t.label;
      b.addEventListener('click', function () { tab = t.key; route = []; drawView(); drawTabs(); });
      nav.appendChild(b);
    });
  }

  function row(rank, name, meta, lb, onTap) {
    var li = document.createElement('li');
    var inner = document.createElement(onTap ? 'button' : 'div');
    inner.className = 'row';
    if (onTap) { inner.type = 'button'; inner.addEventListener('click', onTap); }
    inner.innerHTML = '<span class="rank"></span><span class="info"><span class="name"></span>' +
      '<span class="meta"></span></span><span class="lb"></span>';
    inner.querySelector('.rank').textContent = '#' + rank;
    inner.querySelector('.name').textContent = name;
    inner.querySelector('.meta').textContent = meta || '';
    inner.querySelector('.lb').textContent = fmt(lb) + ' lb';
    if (onTap) inner.classList.add('tappable');
    li.appendChild(inner);
    return li;
  }

  function show(title, note, items, backLabel) {
    $('view-title').textContent = title;
    $('view-note').textContent = note || '';
    var back = $('back');
    back.hidden = !backLabel;
    back.textContent = backLabel ? '← ' + backLabel : '';
    var rows = $('rows');
    rows.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'Nobody on this board yet.';
      rows.appendChild(empty);
    }
    items.forEach(function (li) { rows.appendChild(li); });
  }

  function participation(a) { return a.donors + ' of ' + a.size + ' have donated'; }

  function studentsOf(advisory) {
    return rerank(data.students.filter(function (s) { return s.advisory === advisory; }))
      .map(function (s) { return row(s.rank, s.name, '', s.lb); });
  }

  function advisoriesOf(grade) {
    return rerank(data.advisories.filter(function (a) { return a.grade === grade; }))
      .map(function (a) {
        return row(a.rank, a.name, participation(a), a.lb, function () { route.push({ advisory: a.name }); drawView(); });
      });
  }

  function drawView() {
    $('findme').hidden = tab !== 'findme';
    $('view').hidden = tab === 'findme';
    if (tab === 'findme') return drawFindMe();
    var last = route[route.length - 1];
    if (last && last.advisory) {
      var a = data.advisories.filter(function (x) { return x.name === last.advisory; })[0];
      var from = route.length > 1 ? 'Grade ' + route[0].grade : 'Advisories';
      return show(last.advisory + ' advisory', a ? participation(a) : '', studentsOf(last.advisory), from);
    }
    if (last && last.grade !== undefined) {
      return show('Grade ' + last.grade + ' advisories', '', advisoriesOf(last.grade), 'Grades');
    }
    if (tab === 'grades') {
      return show('Grades', 'Tap a grade to see its advisories.', data.grades.map(function (g) {
        return row(g.rank, 'Grade ' + g.name, '', g.lb, function () { route = [{ grade: Number(g.name) }]; drawView(); });
      }));
    }
    if (tab === 'advisories') {
      return show('Advisories', 'Tap an advisory to see its students.', data.advisories.map(function (a) {
        return row(a.rank, a.name, 'Grade ' + a.grade + ' · ' + participation(a), a.lb,
          function () { route = [{ advisory: a.name }]; drawView(); });
      }));
    }
    if (tab === 'students') {
      return show('Top students', 'Tied students share a place.', data.topStudents.map(function (s) {
        return row(s.rank, s.name, s.advisory + ' · Grade ' + s.grade, s.lb);
      }));
    }
    if (tab === 'faculty') {
      return show('Faculty and staff', 'Counts toward the ton, but not toward the student races.',
        data.faculty.map(function (f) { return row(f.rank, f.name, '', f.lb); }));
    }
    var contest = data.contests[Number(tab.replace('contest', ''))];
    var note = (contest.description ? contest.description + ' ' : '') + 'Ends ' + longDate(contest.endDay) + '.';
    show(contest.name, note, contest.rows.map(function (r) {
      var name = contest.scope === 'grade' ? 'Grade ' + r.name : r.name;
      var meta = contest.scope === 'advisory' ? participation(r) : '';
      return row(r.rank, name, meta, r.lb);
    }));
  }

  $('back').addEventListener('click', function () { route.pop(); drawView(); });

  // ---- Find me ----
  // Everyone is searchable, including people who haven't donated.

  var cardFor = null;   // id of the person whose card is open
  var askedFor = null;  // id the last card request was for

  function rememberedId() {
    try { var me = JSON.parse(localStorage.getItem(STORE_KEY)); return me && me.id; } catch (e) { return null; }
  }

  function drawFindMe() {
    if (cardFor === null && rememberedId()) cardFor = rememberedId();
    if (cardFor) return openCard(cardFor);
    $('card').hidden = true;
    $('findme-search').hidden = false;
    drawResults($('findme-input').value);
  }

  function drawResults(search) {
    var list = $('findme-results');
    list.innerHTML = '';
    var q = search.trim().toLowerCase();
    if (!q) return;
    var people = data.students.map(function (p) { return { id: p.id, name: p.name, meta: p.advisory + ' · Grade ' + p.grade }; })
      .concat((data.staff || []).map(function (p) { return { id: p.id, name: p.name, meta: 'Faculty and staff' }; }));
    var found = people.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 30);
    if (!found.length) {
      var none = document.createElement('li');
      none.className = 'muted';
      none.textContent = 'No one by that name. Try fewer letters.';
      list.appendChild(none);
    }
    found.forEach(function (p) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'row tappable';
      b.innerHTML = '<span class="info"><span class="name"></span><span class="meta"></span></span>';
      b.querySelector('.name').textContent = p.name;
      b.querySelector('.meta').textContent = p.meta;
      b.addEventListener('click', function () { cardFor = p.id; openCard(p.id); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function openCard(id) {
    $('findme-search').hidden = true;
    $('card').hidden = false;
    askedFor = id;
    $('card-name').textContent = 'Loading…';
    ['card-where', 'card-total', 'card-moveup'].forEach(function (k) { $(k).textContent = ''; });
    $('card-ranks').innerHTML = '';
    $('card-history').innerHTML = '';
    api({ action: 'person', person: id }).then(function (r) {
      if (askedFor !== id) return;           // a newer card was opened meanwhile
      if (!r.ok) { cardFor = null; return drawFindMe(); }
      drawCard(r);
    }).catch(function () { $('card-name').textContent = "We can't reach the leaderboard right now."; });
  }

  function addItem(list, text) {
    var li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  }

  function cansWord(n) { return n === 1 ? 'can' : 'cans'; }

  function drawCard(r) {
    $('card-name').textContent = r.name;
    $('card-where').textContent = r.type === 'faculty' ? 'Faculty and staff' : r.advisory + ' advisory · Grade ' + r.grade;
    $('card-total').textContent = fmt(r.totalLb) + ' lb so far';
    var ranks = $('card-ranks');
    if (r.type === 'faculty') {
      addItem(ranks, '#' + r.faculty.rank + ' of ' + r.faculty.of + ' on the faculty board');
    } else {
      addItem(ranks, '#' + r.advisoryRank.rank + ' of ' + r.advisoryRank.of + ' in ' + r.advisory + ' advisory');
      addItem(ranks, '#' + r.gradeRank.rank + ' of ' + r.gradeRank.of + ' in Grade ' + r.grade);
      addItem(ranks, '#' + r.school.rank + ' of ' + r.school.of + ' in the school');
    }
    var m = r.moveUp;
    if (!m) {
      $('card-moveup').textContent = "You're in first place.";
    } else {
      $('card-moveup').textContent = m.cans + ' more ' + cansWord(m.cans) + ' puts you at #' + m.rank +
        (m.passes > 0 ? ', past ' + m.passes + (m.passes === 1 ? ' person.' : ' people.') : '.');
    }
    var history = $('card-history');
    if (!r.history.length) addItem(history, 'Nothing logged yet.');
    r.history.slice().reverse().forEach(function (h) {
      addItem(history, longDate(h.day) + ': ' + h.cans + ' ' + cansWord(h.cans));
    });
  }

  $('findme-input').addEventListener('input', function (e) { drawResults(e.target.value); });
  $('card-back').addEventListener('click', function () {
    cardFor = '';               // '' means "searching", so the remembered person doesn't reopen
    $('card').hidden = true;
    $('findme-search').hidden = false;
    $('findme-input').focus();
    drawResults($('findme-input').value);
  });

  // ---- Hallway screen ----

  function daysFrom(fromDay, toDay) {
    var a = fromDay.split('-'), b = toDay.split('-');
    return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 86400000);
  }

  function drawTv() {
    var goal = data.goalLb || 1;
    $('tv-total').textContent = fmt(data.totalLb) + ' lb';
    $('tv-goal').textContent = 'of ' + fmt(goal) + ' lb, one ton of food';
    var scale = Math.max(goal, data.totalLb);
    $('tv-fill').style.width = (100 * data.totalLb / scale) + '%';
    $('tv-bar').classList.toggle('over', data.totalLb > goal);
    var marks = $('tv-marks');
    marks.innerHTML = '';
    (data.milestones || []).forEach(function (m) {
      var tick = document.createElement('span');
      tick.className = 'mark' + (data.totalLb >= m ? ' reached' : '');
      tick.style.left = (100 * m / scale) + '%';
      tick.textContent = fmt(m);
      marks.appendChild(tick);
    });

    // A screenshot with no date makes people doubt the number.
    var today = todayKey();
    var stamp;
    if (data.startDay && today < data.startDay) {
      stamp = 'The drive starts ' + longDate(data.startDay) + '.';
    } else if (data.endDay && today > data.endDay) {
      stamp = 'Final total. The drive ended ' + longDate(data.endDay) + '.';
    } else {
      stamp = 'Standings as of ' + longDate(today);
      if (data.startDay && data.endDay) {
        stamp += ', day ' + (daysFrom(data.startDay, today) + 1) + ' of ' + (daysFrom(data.startDay, data.endDay) + 1);
      }
    }
    $('tv-stamp').textContent = stamp;
    $('loading').hidden = true;
    $('tv').hidden = false;
  }

  // ---- Loading and refreshing ----

  function load() {
    return api({ action: 'leaderboard' }).then(function (reply) {
      if (!reply.ok) throw new Error('not ok');
      data = reply;
      if (TV) return drawTv();
      $('loading').hidden = true;
      $('error').hidden = true;
      $('board').hidden = false;
      drawTracker();
      drawTabs();
      drawView();
      $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
        '. Refreshes every 2 minutes.';
    }).catch(function () {
      if (!data) { $('loading').hidden = true; $('error').hidden = false; }
    });
  }

  if (TV) document.body.classList.add('tv');
  load();
  if (!TV) setInterval(load, REFRESH_MS);
})();
