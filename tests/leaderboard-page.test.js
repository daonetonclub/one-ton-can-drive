// Browser tests for the leaderboard page (docs/leaderboard.html). The pretend
// server answers with buildLeaderboard run on the known-answer data set, so
// the page is checked against the same numbers as tests/leaderboard.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const S = require('../apps-script/Standings.js');

const DOCS = path.join(__dirname, '..', 'docs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const P = (id, name, grade, advisory, type) => ({ id, name, grade, advisory, type: type || 'student', email: id + '@example.com' });
const roster = [
  P('s01', 'Ann Able', 9, 'Maple'), P('s02', 'Bo Baker', 9, 'Maple'),
  P('s03', 'Cy Carter', 9, 'Birch'), P('s04', 'Di Dunn', 9, 'Birch'),
  P('s05', 'Ed Ellis', 10, 'Cedar'), P('s06', 'Flo Fox', 10, 'Cedar'),
  P('t01', 'Pat Teach', '', '', 'faculty'), P('t02', 'Sam Staff', '', '', 'faculty')
];
const G = (personId, cans, offset, source) => ({ personId, cans, day: day(offset), source: source || 'student', timestamp: 0 });
const donations = [
  G('s01', 10, -3), G('s02', 7, -2), G('s03', 7, -1), G('s05', 5, -1), G('s06', 2, -2), G('t01', 12, -2, 'faculty')
];

function configFor(options) {
  const o = Object.assign({ goalLb: 2000, milestones: [500, 1000, 1500, 2000], startDay: day(-5), endDay: day(30), contests: [] }, options);
  return { o, config: { startDay: o.startDay, endDay: o.endDay, goalLb: o.goalLb,
                        milestones: o.milestones, poundsPerCan: 1, fullNames: false } };
}

// The pretend server: the same functions the real one runs, on the test data.
function answer(body, options) {
  const { o, config } = configFor(options);
  if (body.action === 'person') {
    return S.personReport(donations, roster, config, body.person) || { ok: false, error: 'unknown_person' };
  }
  return Object.assign(S.buildLeaderboard(donations, roster, config, o.contests, day(0)), { asOf: new Date().toISOString() });
}

let server;
let browser;
let base;

test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(DOCS, req.url.split('?')[0]);
    if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch();
});

test.after(async () => {
  await browser.close();
  server.close();
});

async function open(options, viewport, remembered) {
  const context = await browser.newContext({ viewport: viewport || { width: 390, height: 800 } });
  const page = await context.newPage();
  if (remembered) {
    await page.addInitScript(me => localStorage.setItem('oneTon.me', JSON.stringify(me)), remembered);
  }
  await page.route('https://script.google.com/**', r => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify(answer(JSON.parse(r.request().postData() || '{}'), options)) }));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(base + 'leaderboard.html');
  await page.locator('#board').waitFor();
  return { page, context };
}

const rowsText = page => page.locator('#rows li').allInnerTexts()
  .then(list => list.map(t => t.replace(/\s+/g, ' ').trim()));

test('tracker, pace line, everyone-brings-five and faculty line', async () => {
  const { page, context } = await open();
  assert.equal(await page.locator('#total').textContent(), '43 lb');          // 31 student + 12 faculty
  assert.equal(await page.locator('#goal').textContent(), 'of 2,000 lb');
  assert.match(await page.locator('#five').textContent(), /^There are 6 of us\. If everyone brings 334, we hit the ton\.$/);
  assert.equal(await page.locator('#disclosure').textContent(), 'Includes 12 lb from faculty and staff.');
  assert.match(await page.locator('#pace').textContent(), /lb a day from here reaches 2,000 lb by .*Yesterday the school brought in 12 lb\./);
  assert.equal(await page.locator('#pace').evaluate(e => e.classList.contains('behind')), true, 'amber when behind');
  await context.close();
});

test('the bar keeps going past the goal', async () => {
  const { page, context } = await open({ goalLb: 20, milestones: [10, 20] });
  assert.equal(await page.locator('#bar').evaluate(e => e.classList.contains('over')), true);
  const fill = await page.locator('#bar-fill').evaluate(e => e.style.width);
  assert.equal(fill, '100%', 'the bar fills and the scale grows past the goal');
  const goalMark = await page.locator('.mark').last().evaluate(e => parseFloat(e.style.left));
  assert.ok(goalMark < 100, 'the goal mark sits inside the bar, not at the end');
  assert.equal(await page.locator('#pace').textContent(), 'We hit the ton!');
  await context.close();
});

test('on the first day there is no "yesterday" and no amber', async () => {
  const { page, context } = await open({ startDay: day(0) });
  assert.doesNotMatch(await page.locator('#pace').textContent(), /Yesterday/);
  assert.equal(await page.locator('#pace').evaluate(e => e.classList.contains('behind')), false);
  await context.close();
});

test('grade board and drill-down: grade, then advisory, then back the same way', async () => {
  const { page, context } = await open();
  assert.deepEqual(await rowsText(page), ['#1 Grade 9 24 lb', '#2 Grade 10 7 lb']);
  await page.locator('#rows li').first().locator('button').click();
  assert.equal(await page.locator('#view-title').textContent(), 'Grade 9 advisories');
  assert.deepEqual(await rowsText(page), ['#1 Maple 2 of 2 have donated 17 lb', '#2 Birch 1 of 2 have donated 7 lb']);
  await page.locator('#rows li').nth(1).locator('button').click();
  assert.equal(await page.locator('#view-title').textContent(), 'Birch advisory');
  assert.deepEqual(await rowsText(page), ['#1 Cy C. 7 lb', '#2 Di D. 0 lb']);
  await page.click('#back');
  assert.equal(await page.locator('#view-title').textContent(), 'Grade 9 advisories');
  await page.click('#back');
  assert.equal(await page.locator('#view-title').textContent(), 'Grades');
  await context.close();
});

test('tabs: advisories, top students (ties share a place), faculty', async () => {
  const { page, context } = await open();
  await page.getByRole('tab', { name: 'Advisories' }).click();
  assert.deepEqual(await rowsText(page), [
    '#1 Maple Grade 9 · 2 of 2 have donated 17 lb', '#2 Birch Grade 9 · 1 of 2 have donated 7 lb',
    '#2 Cedar Grade 10 · 2 of 2 have donated 7 lb']);
  await page.getByRole('tab', { name: 'Top students' }).click();
  assert.deepEqual(await rowsText(page), [
    '#1 Ann A. Maple · Grade 9 10 lb', '#2 Bo B. Maple · Grade 9 7 lb', '#2 Cy C. Birch · Grade 9 7 lb',
    '#4 Ed E. Cedar · Grade 10 5 lb', '#5 Flo F. Cedar · Grade 10 2 lb']);
  await page.getByRole('tab', { name: 'Faculty' }).click();
  assert.deepEqual(await rowsText(page), ['#1 Pat T. 12 lb']);
  await context.close();
});

test('contest tabs appear only while a contest is running', async () => {
  let { page, context } = await open();
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Grades', 'Advisories', 'Top students', 'Faculty', 'Find me']);
  await context.close();
  ({ page, context } = await open({ contests: [
    { name: 'This week', startDay: day(-2), endDay: day(4), scope: 'student', filter: 'all', description: 'Most cans this week.' },
    { name: 'Next month', startDay: day(20), endDay: day(27), scope: 'grade', filter: 'all', description: '' }
  ] }));
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Grades', 'Advisories', 'Top students', 'Faculty', 'Find me', 'This week']);
  await page.getByRole('tab', { name: 'This week' }).click();
  assert.deepEqual(await rowsText(page), ['#1 Bo B. 7 lb', '#1 Cy C. 7 lb', '#3 Ed E. 5 lb', '#4 Flo F. 2 lb']);
  await context.close();
});

test('no email address and no full name anywhere on the page', async () => {
  const { page, context } = await open();
  for (const name of ['Grades', 'Advisories', 'Top students', 'Faculty', 'Find me']) {
    await page.getByRole('tab', { name }).click();
    const text = await page.locator('body').innerText();
    assert.doesNotMatch(text, /@/);
    for (const p of roster) assert.equal(text.includes(p.name), false, p.name);
  }
  await context.close();
});

test('fits a phone with no sideways scrolling, and works on a laptop', async () => {
  let { page, context } = await open();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await context.close();
  ({ page, context } = await open({}, { width: 1280, height: 800 }));
  assert.equal(await page.locator('#total').textContent(), '43 lb');
  await context.close();
});

test('the donation page links to the leaderboard', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('https://script.google.com/**', r => r.abort());
  await page.goto(base + 'index.html');
  assert.equal(await page.getAttribute('.top-link', 'href'), 'leaderboard.html');
  assert.equal(await page.locator('#screen-done a.btn-primary').getAttribute('href'), 'leaderboard.html');
  await context.close();
});

// Find me. Students: Ann 10 (#1), Bo 7 (#2), Cy 7 (#2), Ed 5 (#4), Flo 2 (#5), Di 0 (#6).

test('Find me: someone with nothing donated is found, with ranks and a way up', async () => {
  const { page, context } = await open();
  await page.getByRole('tab', { name: 'Find me' }).click();
  await page.fill('#findme-input', 'di');
  assert.deepEqual(await page.locator('#findme-results .name').allTextContents(), ['Di D.']);
  await page.locator('#findme-results button').first().click();
  await page.locator('#card-name', { hasText: 'Di D.' }).waitFor();
  assert.equal(await page.locator('#card-where').textContent(), 'Birch advisory · Grade 9');
  assert.equal(await page.locator('#card-total').textContent(), '0 lb so far');
  assert.deepEqual(await page.locator('#card-ranks li').allTextContents(),
    ['#2 of 2 in Birch advisory', '#4 of 4 in Grade 9', '#6 of 6 in the school']);
  assert.equal(await page.locator('#card-moveup').textContent(), '2 more cans puts you at #5.');
  assert.deepEqual(await page.locator('#card-history li').allTextContents(), ['Nothing logged yet.']);
  await context.close();
});

test('Find me: a donor sees history, newest first, and the next-distinct-total line', async () => {
  const { page, context } = await open();
  await page.getByRole('tab', { name: 'Find me' }).click();
  await page.fill('#findme-input', 'bo');
  await page.locator('#findme-results button').first().click();
  await page.locator('#card-name', { hasText: 'Bo B.' }).waitFor();
  assert.equal(await page.locator('#card-moveup').textContent(), '3 more cans puts you at #1, past 1 person.');
  assert.equal(await page.locator('#card-history li').count(), 1);
  assert.match(await page.locator('#card-history li').first().textContent(), /: 7 cans$/);
  await page.click('#card-back');
  assert.equal(await page.locator('#findme-search').isVisible(), true);
  await context.close();
});

test('Find me: staff who have donated nothing are found too', async () => {
  const { page, context } = await open();
  await page.getByRole('tab', { name: 'Find me' }).click();
  await page.fill('#findme-input', 'sam');
  await page.locator('#findme-results button').first().click();
  await page.locator('#card-name', { hasText: 'Sam S.' }).waitFor();
  assert.equal(await page.locator('#card-where').textContent(), 'Faculty and staff');
  assert.deepEqual(await page.locator('#card-ranks li').allTextContents(), ['#2 of 2 on the faculty board']);
  await context.close();
});

test('Find me opens on you if this phone remembers you', async () => {
  const { page, context } = await open({}, null, { id: 's01', name: 'Ann A.', grade: 9, advisory: 'Maple' });
  await page.getByRole('tab', { name: 'Find me' }).click();
  await page.locator('#card-name', { hasText: 'Ann A.' }).waitFor();
  assert.equal(await page.locator('#card-moveup').textContent(), "You're in first place.");
  await context.close();
});

// Hallway screen (?tv=1)

async function openTv(options) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.route('https://script.google.com/**', r => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify(answer(JSON.parse(r.request().postData() || '{}'), options)) }));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(base + 'leaderboard.html?tv=1');
  await page.locator('#tv').waitFor();
  return { page, context };
}

const tvRows = (page, id) => page.locator('#' + id + ' li').allInnerTexts()
  .then(list => list.map(t => t.replace(/\s+/g, ' ').trim()));

test('hallway screen: big number, date stamp with day count, and short boards (decision 21)', async () => {
  // Started 5 days ago (today is day 6), ends in 30 days (36 days in all).
  const { page, context } = await openTv();
  assert.equal(await page.locator('#tv-total').textContent(), '43 lb');
  assert.match(await page.locator('#tv-stamp').textContent(), /^Standings as of [A-Z][a-z]{2} \d{1,2}, day 6 of 36$/);
  assert.deepEqual(await tvRows(page, 'tv-grades'), ['#1 Grade 9 24 lb', '#2 Grade 10 7 lb']);
  assert.deepEqual(await tvRows(page, 'tv-advisories'), ['#1 Maple 17 lb', '#2 Birch 7 lb', '#2 Cedar 7 lb']);
  assert.deepEqual(await tvRows(page, 'tv-students'),
    ['#1 Ann A. 10 lb', '#2 Bo B. 7 lb', '#2 Cy C. 7 lb', '#4 Ed E. 5 lb', '#5 Flo F. 2 lb']);
  const text = await page.locator('body').innerText();
  for (const p of roster) assert.equal(text.includes(p.name), false, 'no full name: ' + p.name);
  assert.equal(text.includes('Pat T.'), false, 'faculty stay off the student board');
  assert.doesNotMatch(text, /live|refresh|updat/i, 'never claims to update live');
  assert.equal(await page.locator('#board').isVisible(), false, 'no tabs');
  await context.close();
});

test('hallway screen fits a 1920x1080 TV without scrolling', async () => {
  const { page, context } = await openTv();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth &&
    document.documentElement.scrollHeight <= window.innerHeight);
  assert.equal(fits, true);
  await context.close();
});

test('hallway screen before the start and after the end', async () => {
  let { page, context } = await openTv({ startDay: day(3), endDay: day(40) });
  assert.match(await page.locator('#tv-stamp').textContent(), /^The drive starts /);
  await context.close();
  ({ page, context } = await openTv({ startDay: day(-40), endDay: day(-2) }));
  assert.match(await page.locator('#tv-stamp').textContent(), /^Final total\. The drive ended /);
  await context.close();
});

test('hallway screen: a big tie shows 8 rows and "+ N more tied", and still fits', async () => {
  // 20 students with 1 can each: all tied at #1.
  const many = Array.from({ length: 20 }, (_, i) => P('m' + i, 'Kid Number' + i, 9, 'Maple'));
  const saved = roster.splice(0, roster.length, ...many);
  const savedGifts = donations.splice(0, donations.length, ...many.map(p => G(p.id, 1, -1)));
  try {
    const { page, context } = await openTv();
    assert.equal(await page.locator('#tv-students li:not(.more)').count(), 8);
    assert.equal(await page.locator('#tv-students li.more').textContent(), '+ 12 more tied at #1');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight), true);
    await context.close();
  } finally {
    roster.splice(0, roster.length, ...saved);
    donations.splice(0, donations.length, ...savedGifts);
  }
});
