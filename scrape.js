import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2' }).catch(e => console.log(e));
  await new Promise(r => setTimeout(r, 2000));
  
  const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NOT FOUND');
  console.log('ROOT CONTENT:', rootContent.substring(0, 500));
  if (rootContent.includes('Uygulama Hatası:')) {
     console.log('FOUND ErrorBoundary IN DOM');
  }
  await browser.close();
})();
