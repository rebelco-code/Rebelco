import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();
  console.log("Navigating to Canva presentation view...");
  await page.goto('https://www.canva.com/design/DAHBfrTi4fg/hb9FSxVf1f7SE4McMvg1Ng/view', { waitUntil: 'networkidle2' });

  await new Promise(r => setTimeout(r, 6000));

  await page.mouse.click(960, 540);
  await new Promise(r => setTimeout(r, 1000));

  for (let i = 1; i <= 13; i++) {
    const path = `c:/Users/berti/.gemini/antigravity/scratch/rebelco/public/canva_slide_${i}.png`;
    console.log(`Screenshotting slide ${i} to ${path}`);
    await page.screenshot({ path: path, fullPage: false });
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log("Screenshots completed successfully.");
})();
