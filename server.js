const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('Server Puppeteer is running!'));

app.post('/generate-and-send', async (req, res) => {
  const { htmlContent, chatId, zaloToken } = req.body;

  if (!htmlContent || !chatId || !zaloToken) {
    return res.status(400).json({ error: 'Thiếu dữ liệu htmlContent, chatId hoặc zaloToken' });
  }

  let browser;
  try {
    // Khởi tạo browser với các tham số tối ưu cho Render
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 750, height: 100, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const element = await page.$('.card');
    const imageBuffer = element 
      ? await element.screenshot({ type: 'png' })
      : await page.screenshot({ fullPage: true, type: 'png' });

    await browser.close();

    // Gửi ảnh sang Zalo Bot
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', imageBuffer, { filename: 'report.png', contentType: 'image/png' });

    const zaloUrl = `https://bot-api.zaloplatforms.com/bot${zaloToken.trim()}/sendPhoto`;
    const zaloRes = await axios.post(zaloUrl, formData, {
      headers: formData.getHeaders()
    });

    return res.json({ success: true, data: zaloRes.data });

  } catch (err) {
    if (browser) await browser.close();
    console.error('Lỗi Render:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
