import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();

  await page.goto('https://www.canva.com/design/DAHBfrTi4fg/hb9FSxVf1f7SE4McMvg1Ng/view', { waitUntil: 'networkidle2' });

  // Wait for initial load
  await new Promise(r => setTimeout(r, 8000));

  // Try sending arrow right to the exact body element
  for (let i = 1; i <= 15; i++) {
    const path = `c:/Users/berti/.gemini/antigravity/scratch/rebelco/public/canva_slide_${i}.png`;

    // Screenshot
    await page.screenshot({ path: path, fullPage: false });

    // Evaluate in page to click the Next button safely
    await page.evaluate(() => {
      // Canva's Next Button usually has aria-label="Next page" or "Next" or has a path 'M....'
      // Let's just trigger a Space key or ArrowRight on window
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', keyCode: 39, code: 'ArrowRight', which: 39, bubbles: true
      }));
    });

    // Let's also literally click near the right edge of the screen, presentations often go forward
    await page.mouse.click(1800, 500);

    // Let's also use keyboard directly
    await page.keyboard.press('ArrowRight');

    await new Promise(r => setTimeout(r, 4000));
  }

  await browser.close();
})();
