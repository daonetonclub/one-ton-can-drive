// Makes the one QR code for every bin (Phase 5): docs/qr.png, plus a
// printable one-page sign, docs/qr-sign.pdf. Run: node tools/make-qr.js
// The code only holds the public donation address.

const QRCode = require('qrcode');
const { chromium } = require('playwright');
const path = require('path');

const URL_ = 'https://daonetonclub.github.io/one-ton-can-drive/donate.html';
const DOCS = path.join(__dirname, '..', 'docs');

(async () => {
  // High error correction, so a scuffed or partly covered code still scans.
  await QRCode.toFile(path.join(DOCS, 'qr.png'), URL_, { errorCorrectionLevel: 'H', width: 1200, margin: 2,
    color: { dark: '#1B3320', light: '#FFFFFF' } });
  const svg = await QRCode.toString(URL_, { type: 'svg', errorCorrectionLevel: 'H', margin: 1,
    color: { dark: '#1B3320', light: '#FFFFFF' } });

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,500&family=DM+Sans:wght@500;600&display=swap" rel="stylesheet">
  <style>
    @page { size: letter; margin: 0.6in; }
    body { margin: 0; font-family: 'DM Sans', sans-serif; color: #1B2A1F; text-align: center; }
    h1 { font-family: 'Fraunces', serif; font-size: 54pt; color: #2A4C31; margin: 0.2in 0 0; line-height: 1.05; }
    h1 em { display: block; color: #A07C22; font-weight: 500; }
    .qr { width: 5.2in; margin: 0.35in auto 0.2in; }
    .qr svg { width: 100%; height: auto; }
    .step { font-size: 20pt; font-weight: 600; margin: 0; }
    .note { font-size: 13pt; color: #6E7A6F; margin: 8pt 0 0; }
  </style></head><body>
    <h1>The One Ton <em>Can Drive</em></h1>
    <div class="qr">${svg}</div>
    <p class="step">Dropped cans in the bin? Scan to log them.</p>
    <p class="note">Takes about fifteen seconds. Take cans out of the case first: every can counts as one.</p>
  </body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: path.join(DOCS, 'qr-sign.pdf'), format: 'Letter', printBackground: true });
  await browser.close();
  console.log('Wrote docs/qr.png and docs/qr-sign.pdf for ' + URL_);
})();
