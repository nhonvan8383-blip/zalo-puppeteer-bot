const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('Server Puppeteer is running!'));

app.post('/generate-and-send', async (req, res) => {
  const { htmlContent, chat_id, chatId, zaloToken } = req.body;
  const targetChatId = chat_id || chatId || "a5b8109b37d5de8b87c4";
  const targetToken  = zaloToken || "246763022207905113:hhXpfDhSXXjAFwzUrCpCiDkknvfYInOQFeFVfUTgInEfSMNgccNdRvDiYBzfZbkE";

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

    // 2. Tạo FormData ép kiểu Buffer chuẩn cho Zalo API
    const formData = new FormData();
    formData.append('chat_id', String(targetChatId).trim());
    formData.append('photo', imageBuffer, {
      filename: 'report.png',
      contentType: 'image/png',
      knownLength: imageBuffer.length
    });

    // 3. Gửi sang Zalo API bằng Axios với boundary đầy đủ
    const zaloUrl = `https://bot-api.zaloplatforms.com/bot${targetToken.trim()}/sendPhoto`;
    const zaloRes = await axios.post(zaloUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Length': formData.getLengthSync()
      }
    });

    console.log("Zalo Response Success:", zaloRes.data);
    return res.json({ success: true, data: zaloRes.data });

  } catch (err) {
    if (browser) await browser.close();
    console.error('Lỗi Server:', err.response ? err.response.data : err.message);
    return res.status(500).json({ 
      error: err.message, 
      details: err.response ? err.response.data : null 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
