import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--start-fullscreen'],
    headless: "new",
    defaultViewport: null
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  await page.goto('https://www.canva.com/design/DAHBfrTi4fg/hb9FSxVf1f7SE4McMvg1Ng/view', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 6000));

  // Start full screen
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const fsButton = buttons.find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('fullscreen'));
    if (fsButton) fsButton.click();
    else document.documentElement.requestFullscreen();
  });

  await new Promise(r => setTimeout(r, 3500));

  for (let i = 1; i <= 15; i++) {
    const path = `c:/Users/berti/.gemini/antigravity/scratch/rebelco/public/canva_slide_${i}.png`;

    // ENSURE FOCUS! Click center of presentation
    await page.mouse.click(960, 500);
    // hide cursor near bottom edge (away from UI toolbars)
    await page.mouse.move(960, 1000);

    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({ path: path, fullPage: false });
    console.log(`Saved slide ${i}`);

    // Press right arrow to advance slide
    await page.keyboard.press('ArrowRight');

    // Wait for slide transition to finish
    await new Promise(r => setTimeout(r, 2200));
  }

  await browser.close();
})();
