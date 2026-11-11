const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
  await page.goto('http://localhost:5173', {waitUntil: 'networkidle2'}).catch(e => console.log('Navigate error:', e.message));
  await browser.close();
})();
