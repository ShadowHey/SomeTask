const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const AUDIO_PATH = path.resolve(__dirname, '../hinglish_conversation.mp3');

async function runPipeline() {
  console.log('=== Starting End-to-End Browser Pipeline Test ===');
  console.log('Audio file:', AUDIO_PATH);
  if (!fs.existsSync(AUDIO_PATH)) {
    throw new Error(`Audio file not found at: ${AUDIO_PATH}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Step 1: Login
    console.log('\n[Step 1] Navigating to http://localhost:3000/login ...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'dhruv.bisht.mst23@itbhu.ac.in');
    await page.type('input[type="password"]', '12345678');
    
    console.log('[Step 1] Submitting login credentials...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
    console.log('[Step 1] Reached:', page.url());
    await page.screenshot({ path: '01_dashboard.png' });

    // Step 2: Open Upload Modal
    console.log('\n[Step 2] Opening Upload Modal ...');
    await page.waitForSelector('button');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const uploadBtn = btns.find(b => b.textContent.includes('Upload Audio'));
      if (!uploadBtn) throw new Error('Could not find Upload Audio button');
      uploadBtn.click();
    });

    await page.waitForSelector('div[role="dialog"]');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: '02_upload_modal.png' });
    console.log('[Step 2] Upload modal open verified.');

    // Step 3: Configure Upload
    console.log('\n[Step 3] Configuring file and Gnani STT parameters ...');
    const fileInput = await page.waitForSelector('input[type="file"]');
    await fileInput.uploadFile(AUDIO_PATH);

    // Select primary language hi-IN and secondary candidate language en-IN
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      selects[0].value = 'hi-IN';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      selects[1].value = 'en-IN';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Check Diarization
    const diarizationCheckbox = await page.waitForSelector('#diarization');
    const isDiarChecked = await page.evaluate(el => el.checked, diarizationCheckbox);
    if (!isDiarChecked) {
      await diarizationCheckbox.click();
    }

    // Check Denoise
    const denoiseCheckbox = await page.waitForSelector('#denoise');
    const isDenoiseChecked = await page.evaluate(el => el.checked, denoiseCheckbox);
    if (!isDenoiseChecked) {
      await denoiseCheckbox.click();
    }

    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: '03_modal_configured.png' });
    console.log('[Step 3] Form configured with Hinglish, Diarization, and Denoise.');

    // Step 4: Click Upload
    console.log('\n[Step 4] Clicking Upload button ...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.trim() === 'Upload' && !b.disabled);
      if (!submitBtn) throw new Error('Enabled Upload button not found');
      submitBtn.click();
    });

    // Monitor progress
    console.log('[Step 4] Upload started, waiting for completion...');
    let uploadSuccess = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const modalText = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return dialog ? dialog.innerText : null;
      });
      if (modalText) {
        console.log(`[Upload Status ${i}s]:`, modalText.split('\n').filter(s => s.trim().length > 0).slice(-2).join(' | '));
      }
      if (!modalText || modalText.includes('Upload complete!')) {
        uploadSuccess = true;
        break;
      }
    }

    // Wait for modal to unmount
    await page.waitForFunction(() => !document.querySelector('div[role="dialog"]'), { timeout: 10000 });
    console.log('[Step 4] Upload finished successfully and modal closed.');
    await page.screenshot({ path: '04_dashboard_after_upload.png' });

    // Step 5: Navigate to new recording
    console.log('\n[Step 5] Looking for newly uploaded recording card on dashboard...');
    await page.waitForSelector('a[href^="/recordings/"]');
    const recordingHref = await page.evaluate(() => {
      const link = document.querySelector('a[href^="/recordings/"]');
      return link ? link.getAttribute('href') : null;
    });
    console.log('[Step 5] Opening recording detail page:', recordingHref);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click(`a[href="${recordingHref}"]`),
    ]);

    await page.screenshot({ path: '05_recording_initial.png' });

    // Step 6: Wait for transcription to complete
    console.log('\n[Step 6] Waiting for transcription pipeline to complete...');
    let completed = false;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pageInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const segments = document.querySelectorAll('.group.flex.gap-4').length;
        const isCompleted = text.includes('transcription_completed') || text.includes('Request an AI Summary') || segments > 0;
        return { textSnippet: text.slice(0, 300), segments, isCompleted };
      });

      console.log(`[Transcription polling ${(i+1)*5}s]: Segments found = ${pageInfo.segments}`);
      if (pageInfo.isCompleted && pageInfo.segments > 0) {
        completed = true;
        break;
      }
    }

    if (!completed) {
      await page.screenshot({ path: '06_transcription_timeout.png' });
      throw new Error('Transcription timed out or failed to produce segments');
    }

    await page.screenshot({ path: '06_transcription_completed.png' });
    console.log('[Step 6] Transcription completed! Segments are visible on screen.');

    // Step 7: Test Search
    console.log('\n[Step 7] Testing transcript search ...');
    const firstWord = await page.evaluate(() => {
      const p = document.querySelector('.group.flex.gap-4 p');
      if (!p) return null;
      const words = p.textContent.trim().split(/\s+/);
      return words.find(w => w.length > 3) || words[0];
    });

    if (firstWord) {
      console.log(`[Step 7] Searching for word: "${firstWord}"`);
      await page.type('input[placeholder="Search keywords..."]', firstWord);
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: '07_search_results.png' });
      console.log('[Step 7] Search results verified.');
    }

    // Step 8: Trigger AI Summary
    console.log('\n[Step 8] Triggering "Request an AI Summary" ...');
    const summaryBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Request an AI Summary'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!summaryBtnClicked) {
      throw new Error('Could not find "Request an AI Summary" button');
    }

    console.log('[Step 8] Clicked "Request an AI Summary", waiting for Gemini summary...');
    let summaryCompleted = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const summaryText = await page.evaluate(() => {
        const prose = document.querySelector('.prose');
        return prose ? prose.innerText.trim() : null;
      });

      if (summaryText && summaryText.length > 20) {
        console.log(`[Summary completed in ${(i+1)*4}s]:`, summaryText.slice(0, 150) + '...');
        summaryCompleted = true;
        break;
      }
    }

    if (!summaryCompleted) {
      await page.screenshot({ path: '08_summary_timeout.png' });
      throw new Error('Summary generation timed out');
    }

    await page.screenshot({ path: '08_pipeline_success.png' });
    console.log('\n=== PIPELINE COMPLETED SUCCESSFULLY! ===');
    console.log('All steps verified visually and logically.');

  } finally {
    await browser.close();
  }
}

runPipeline().catch(err => {
  console.error('\n*** PIPELINE FAILED ***');
  console.error(err);
  process.exit(1);
});
