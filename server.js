const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('Server Puppeteer is running!'));

// Hàm upload Buffer ảnh lên Imgur lấy URL công khai miễn phí
async function uploadToImgur(imageBuffer) {
  const formData = new FormData();
  formData.append('image', imageBuffer.toString('base64'));
  formData.append('type', 'base64');

  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: 'Client-ID c9824619b0f4fd8' // Client ID ẩn danh miễn phí
    },
    body: formData
  });

  const data = await res.json();
  if (data.success) {
    return data.data.link;
  } else {
    throw new Error('Lỗi upload ảnh Imgur: ' + JSON.stringify(data));
  }
}

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

    // 2. Upload ảnh lên Cloud lấy URL
    const imageUrl = await uploadToImgur(imageBuffer);
    console.log("Image Uploaded URL:", imageUrl);

    // 3. Gửi ảnh qua Zalo API bằng URL
    const zaloUrl = `https://bot-api.zaloplatforms.com/bot${targetToken.trim()}/sendPhoto`;
    
    // Thử gửi dạng JSON Payload với đường dẫn URL ảnh (Chuẩn Zalo Platform)
    let response = await fetch(zaloUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(targetChatId).trim(),
        photo: imageUrl
      })
    });

    let zaloData = await response.json();

    // Nếu Zalo trả về lỗi, thử lại bằng Multipart URL
    if (!zaloData.ok) {
      const formData = new FormData();
      formData.append('chat_id', String(targetChatId).trim());
      formData.append('photo', imageUrl);

      response = await fetch(zaloUrl, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });
      zaloData = await response.json();
    }

    return res.json({ success: true, imageUrl: imageUrl, data: zaloData });

  } catch (err) {
    if (browser) await browser.close();
    console.error('Lỗi Server:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
