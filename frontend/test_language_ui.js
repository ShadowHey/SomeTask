const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'dhruv.bisht.mst23@itbhu.ac.in');
    await page.type('input[type="password"]', '12345678');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);

    // Click Upload Audio button
    await page.waitForSelector('button');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Upload Audio'));
      btn.click();
    });
    await page.waitForSelector('div[role="dialog"]');
    await new Promise(r => setTimeout(r, 600));

    // 1. Initial screenshot (1 language)
    await page.screenshot({ path: 'lang_ui_single.png' });
    console.log('Single language screenshot taken');

    // 2. Select Second language: en-IN
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      selects[1].value = 'en-IN';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'lang_ui_two_languages.png' });
    console.log('Two languages screenshot taken');

    // 3. Select Third language: ta-IN
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      selects[2].value = 'ta-IN';
      selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'lang_ui_three_languages.png' });
    console.log('Three languages screenshot taken');

    // Inspect payload badge text
    const payloadText = await page.evaluate(() => {
      const code = document.querySelector('code');
      return code ? code.innerText : '';
    });
    console.log('Payload text on 3 languages:', payloadText);

    // 4. Switch secondary back to none
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      selects[1].value = '';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'lang_ui_back_to_single.png' });

    const payloadTextAfterReset = await page.evaluate(() => {
      const code = document.querySelector('code');
      return code ? code.innerText : '';
    });
    console.log('Payload text after resetting secondary:', payloadTextAfterReset);

  } finally {
    await browser.close();
  }
})();
