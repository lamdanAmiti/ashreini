const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch opus file URL
app.get('/api/get-audio-url', async (req, res) => {
  try {
    const url = req.query.url || 'https://ashreinu.app';
    
    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36");
    
    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait for audio player to load
    await page.waitForSelector("#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container", { timeout: 30000 });
    
    // Monitor network requests for opus files
    let opusUrl = null;
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.opus')) {
        opusUrl = url;
      }
    });
    
    // Click play button to trigger audio loading
    await page.click("#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container > ion-button.play-btn");
    
    // Wait for opus file to be detected
    await page.waitForTimeout(5000);
    
    // Close browser
    await browser.close();
    
    if (opusUrl) {
      res.json({ success: true, url: opusUrl });
    } else {
      res.status(404).json({ success: false, message: 'Opus file not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
