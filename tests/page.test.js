// Browser tests for the donation page (docs/). The real page runs in headless
// Chrome; the server behind it is pretended here, so no rows reach the Sheet.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DOCS = path.join(__dirname, '..', 'docs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const ROSTER = [
  { id: 'S001', name: 'Avery T.', grade: 9, advisory: 'Maple' },
  { id: 'S002', name: 'Jordan M.', grade: 9, advisory: 'Maple' },
  { id: 'S003', name: 'Riley S.', grade: 9, advisory: 'Birch' },
  { id: 'S005', name: 'Morgan F.', grade: 10, advisory: 'Cedar' },
  { id: 'F001', name: 'Pat T.', grade: '', advisory: '' },
  { id: 'F002', name: 'Lee S.', grade: '', advisory: '' }
];

// A pretend server. Each test can change how it answers.
function fakeServer(options) {
  const o = Object.assign({ startDay: day(-1), endDay: day(30), failSaves: 0, delay: 0 }, options);
  const state = { saves: [], codes: [] };
  async function handle(route) {
    const body = JSON.parse(route.request().postData() || '{}');
    let reply;
    if (body.action === 'roster') reply = { ok: true, people: ROSTER };
    else if (body.action === 'leaderboard') reply = { ok: true, startDay: o.startDay, endDay: o.endDay, totalLb: 1840, poundsPerCan: 1 };
    else if (body.action === 'donate') {
      state.saves.push(body);
      if (o.delay) await new Promise(r => setTimeout(r, o.delay));
      if (o.failSaves > 0) { o.failSaves -= 1; return route.abort('failed'); }
      state.codes.push(body.request);
      const person = ROSTER.find(p => p.id === body.person);
      reply = { ok: true, cans: body.cans, poundsPerCan: 1, name: person.name,
                before: { rank: 4, total: 3 }, after: { rank: 2, total: 3 + body.cans }, passed: 2,
                advisory: person.advisory ? { name: person.advisory, rank: 1, total: 12, donors: 2, size: 2 } : null };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  }
  return { state, handle };
}

let server;
let browser;
let base;

test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(DOCS, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(DOCS) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
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

async function open(options) {
  const fake = fakeServer(options);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('https://script.google.com/**', fake.handle);
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(base + 'donate.html');
  return { page, fake, context };
}

async function pickAvery(page) {
  await page.getByRole('button', { name: /^9/ }).click();
  await page.getByRole('button', { name: 'Maple' }).click();
  await page.getByRole('button', { name: 'Avery T.' }).click();
  await page.locator('#screen-cans').waitFor();
}

const visible = (page, sel) => page.locator(sel).isVisible();

test('grade, advisory, name lead to the cans screen; faculty are not in the student list', async () => {
  const { page, context } = await open();
  await page.locator('#screen-grade').waitFor();
  const grades = await page.locator('#grade-list button').allTextContents();
  assert.deepEqual(grades.map(g => g.replace(/\D+$/, '')), ['9', '10']);
  await pickAvery(page);
  assert.match(await page.locator('#cans-who').textContent(), /Avery T\./);
  await context.close();
});

test('name search narrows the advisory list', async () => {
  const { page, context } = await open();
  await page.getByRole('button', { name: /^9/ }).click();
  await page.getByRole('button', { name: 'Maple' }).click();
  await page.fill('#name-search', 'jor');
  assert.deepEqual(await page.locator('#name-list button').allTextContents(), ['Jordan M.']);
  await context.close();
});

test('cans box: empty is blocked, never logged as 1', async () => {
  const { page, fake, context } = await open();
  await pickAvery(page);
  await page.click('#submit');
  assert.equal(await page.locator('#cans-message').textContent(), 'How many cans?');
  assert.equal(fake.state.saves.length, 0);
  await context.close();
});

test('cans box: typing is never rewritten while typing', async () => {
  const { page, context } = await open();
  await pickAvery(page);
  await page.click('#cans');
  await page.keyboard.type('12');
  assert.equal(await page.inputValue('#cans'), '12');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  assert.equal(await page.inputValue('#cans'), '', 'an emptied box stays empty, not 1');
  await page.keyboard.type('7');
  assert.equal(await page.inputValue('#cans'), '7');
  await context.close();
});

test('cans box: + and − and the quick buttons', async () => {
  const { page, context } = await open();
  await pickAvery(page);
  await page.getByRole('button', { name: '15', exact: true }).click();
  assert.equal(await page.inputValue('#cans'), '15');
  await page.click('[data-action=plus]');
  assert.equal(await page.inputValue('#cans'), '16');
  await page.click('[data-action=minus]');
  await page.click('[data-action=minus]');
  assert.equal(await page.inputValue('#cans'), '14');
  await context.close();
});

test('cans box: 51 is refused with the "log the rest" message', async () => {
  const { page, fake, context } = await open();
  await pickAvery(page);
  await page.fill('#cans', '51');
  await page.click('#submit');
  assert.match(await page.locator('#cans-message').textContent(), /Log 50 now and the rest as a second entry/);
  assert.equal(fake.state.saves.length, 0);
  await context.close();
});

test('20 cans asks "just checking"; "Let me fix it" goes back without saving', async () => {
  const { page, fake, context } = await open();
  await pickAvery(page);
  await page.fill('#cans', '20');
  await page.click('#submit');
  assert.equal(await page.locator('#confirm-text').textContent(), '20 cans, nice. Just checking, is that right?');
  assert.equal(await visible(page, '#submit'), false, 'only Yes and Let me fix it while checking');
  await page.click('[data-action=confirm-fix]');
  assert.equal(await visible(page, '#confirm'), false);
  assert.equal(await visible(page, '#submit'), true);
  assert.equal(fake.state.saves.length, 0);
  await page.fill('#cans', '20');
  await page.click('#submit');
  await page.click('[data-action=confirm-yes]');
  await page.locator('#screen-done').waitFor();
  assert.equal(fake.state.saves.length, 1);
  assert.equal(fake.state.saves[0].cans, 20);
  await context.close();
});

test('a double tap sends exactly one save', async () => {
  const { page, fake, context } = await open({ delay: 400 });
  await pickAvery(page);
  await page.fill('#cans', '5');
  await page.click('#submit');
  await page.click('#submit', { force: true });
  await page.locator('#screen-done').waitFor();
  assert.equal(fake.state.saves.length, 1);
  await context.close();
});

test('a failed save says so, keeps the number, and the retry reuses the same code', async () => {
  const { page, fake, context } = await open({ failSaves: 1 });
  await pickAvery(page);
  await page.fill('#cans', '6');
  await page.click('#submit');
  await page.locator('#cans-message').waitFor();
  assert.equal(await page.locator('#cans-message').textContent(), "That didn't save. Your cans were not counted yet. Try again.");
  assert.equal(await page.inputValue('#cans'), '6');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  assert.equal(fake.state.saves.length, 2);
  assert.equal(fake.state.saves[0].request, fake.state.saves[1].request);
  await context.close();
});

test('done screen shows what the donation did', async () => {
  const { page, context } = await open();
  await pickAvery(page);
  await page.fill('#cans', '4');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  const text = await page.locator('#screen-done').innerText();
  assert.match(text, /4 cans counted for Avery T\. They/);
  assert.match(text, /You moved from #4 to #2\./);
  assert.match(text, /You passed 2 people\./);
  assert.match(text, /Maple advisory is #1 with 12 lb\. 2 of 2 have donated\./);
  assert.match(await page.getAttribute('#report', 'href'), /^mailto:/);
  await context.close();
});

test('the phone remembers you; "Not you?" starts over', async () => {
  const { page, context } = await open();
  await pickAvery(page);
  await page.fill('#cans', '3');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  await page.reload();
  await page.locator('#screen-cans').waitFor();
  assert.match(await page.locator('#cans-who').textContent(), /Avery T\./);
  assert.equal(await visible(page, '#remembered'), true);
  await page.click('[data-action=not-me]');
  await page.locator('#screen-grade').waitFor();
  await page.reload();
  await page.locator('#screen-grade').waitFor();
  await context.close();
});

test('before the start and after the end, the form is replaced', async () => {
  let { page, context } = await open({ startDay: day(2), endDay: day(40) });
  await page.locator('#screen-closed').waitFor();
  assert.match(await page.locator('#closed-title').textContent(), /^The drive starts /);
  assert.equal(await page.locator('#closed-text').textContent(), 'See you then!');
  await context.close();
  ({ page, context } = await open({ startDay: day(-40), endDay: day(-1) }));
  await page.locator('#screen-closed').waitFor();
  assert.equal(await page.locator('#closed-title').textContent(), 'The drive is over. Thank you!');
  assert.equal(await page.locator('#closed-text').textContent(), 'We collected 1840 lb.');
  await context.close();
});

test('the page never shows an email address', async () => {
  const { page, context } = await open();
  for (const screen of ['#screen-grade']) {
    await page.locator(screen).waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), /@/);
  }
  await pickAvery(page);
  await page.fill('#cans', '2');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(), /@/);
  await context.close();
});

// Faculty and staff path

test('faculty link leads to the staff list, with search', async () => {
  const { page, context } = await open();
  await page.locator('#screen-grade').waitFor();
  await page.click('[data-action=staff]');
  await page.locator('#screen-staff').waitFor();
  assert.deepEqual(await page.locator('#staff-list button').allTextContents(), ['Lee S.', 'Pat T.']);
  await page.fill('#staff-search', 'pat');
  assert.deepEqual(await page.locator('#staff-list button').allTextContents(), ['Pat T.']);
  await context.close();
});

test('a staff donation shows the faculty rank and no advisory, and is remembered', async () => {
  const { page, fake, context } = await open();
  await page.locator('#screen-grade').waitFor();
  await page.click('[data-action=staff]');
  await page.getByRole('button', { name: 'Pat T.' }).click();
  assert.equal(await page.locator('#cans-who').textContent(), 'Pat T. · Faculty and staff');
  await page.fill('#cans', '8');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  assert.equal(fake.state.saves[0].person, 'F001');
  const text = await page.locator('#screen-done').innerText();
  assert.match(text, /You moved from #4 to #2 on the faculty board\./);
  assert.doesNotMatch(text, /advisory/);
  await page.reload();
  await page.locator('#screen-cans').waitFor();
  assert.equal(await page.locator('#cans-who').textContent(), 'Pat T. · Faculty and staff');
  await context.close();
});

// Mockup layout (progress bar, grade chip, greeting) and the home page

test('the progress bar and grade chip follow the steps', async () => {
  const { page, context } = await open();
  await page.locator('#screen-grade').waitFor();
  const dots = () => page.locator('#steps .step-dot').evaluateAll(d => d.map(x => x.className.replace('step-dot', '').trim() || '-'));
  assert.deepEqual(await dots(), ['active', '-', '-', '-']);
  assert.equal(await page.locator('#grade-badge').isVisible(), false);
  await page.getByRole('button', { name: /^9/ }).click();
  assert.deepEqual(await dots(), ['done', 'active', '-', '-']);
  assert.equal(await page.locator('#grade-badge').textContent(), 'Grade 9');
  await page.getByRole('button', { name: 'Maple' }).click();
  assert.deepEqual(await dots(), ['done', 'done', 'active', '-']);
  await page.getByRole('button', { name: 'Avery T.' }).click();
  assert.deepEqual(await dots(), ['done', 'done', 'done', 'active']);
  assert.equal(await page.locator('#cans-first').textContent(), 'Avery');
  await page.fill('#cans', '2');
  await page.click('#submit');
  await page.locator('#screen-done').waitFor();
  assert.equal(await page.locator('#flow-head').isVisible(), false, 'no step bar on the done screen');
  await context.close();
});

test('the home page links to donating and the leaderboard, with the drive dates', async () => {
  const fake = fakeServer({ startDay: '2027-01-19', endDay: '2027-03-04' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('https://script.google.com/**', fake.handle);
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(base);
  await page.locator('#eyebrow', { hasText: 'Jan 19' }).waitFor();
  assert.equal(await page.locator('#eyebrow').textContent(), 'Durham Academy · Jan 19 to Mar 4');
  assert.equal(await page.getAttribute('.card-donate', 'href'), 'donate.html');
  assert.equal(await page.getAttribute('.card-leaderboard', 'href'), 'leaderboard.html');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await context.close();
});

test('no donation screen scrolls sideways at phone width', async () => {
  const { page, context } = await open();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('#screen-grade').waitFor();
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.equal(await fits(), true, 'grade');
  await pickAvery(page);
  assert.equal(await fits(), true, 'cans');
  await context.close();
});
