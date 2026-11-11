import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.text().includes('RENDER 3D')) errors.push(msg.text());
  });
  page.on('pageerror', error => errors.push(error.stack));
  
  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch(e) {}
  
  console.log("ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})();
