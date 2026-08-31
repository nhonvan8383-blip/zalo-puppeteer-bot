const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('Server Puppeteer is running!'));

app.post('/generate-and-send', async (req, res) => {
  const { htmlContent, chat_id, chatId, zaloToken } = req.body;
  const targetChatId = String(chat_id || chatId || "a5b8109b37d5de8b87c4").trim();
  const targetToken  = String(zaloToken || "246763022207905113:hhXpfDhSXXjAFwzUrCpCiDkknvfYInOQFeFVfUTgInEfSMNgccNdRvDiYBzfZbkE").trim();

  if (!htmlContent) {
    return res.status(400).json({ error: 'Thiếu nội dung htmlContent' });
  }

  let browser;
  try {
    // 1. Chụp ảnh HTML bằng Puppeteer
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 750, height: 100, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const element = await page.$('.card');
    const imageBuffer = element 
      ? await element.screenshot({ type: 'png' })
      : await page.screenshot({ fullPage: true, type: 'png' });

    await browser.close();

    // 2. Dùng FormData & Blob native của Node.js (Không bị lỗi header/boundary)
    const formData = new FormData();
    formData.append('chat_id', targetChatId);
    
    // Đưa Buffer vào Blob chuẩn của Node.js
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('photo', imageBlob, 'report.png');

    // 3. Gửi sang Zalo API bằng fetch native
    const zaloUrl = `https://bot-api.zaloplatforms.com/bot${targetToken}/sendPhoto`;
    const response = await fetch(zaloUrl, {
      method: 'POST',
      body: formData
    });

    const zaloData = await response.json();
    console.log("Zalo Response:", zaloData);

    return res.json({ success: true, data: zaloData });

  } catch (err) {
    if (browser) await browser.close();
    console.error('Lỗi Server:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
