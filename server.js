const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Route to fetch opus file
app.get('/fetch-audio', async (req, res) => {
  try {
    console.log('Starting puppeteer...');
    
    // Launch puppeteer with specific args for Render.com
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Enable request interception to capture audio files
    await page.setRequestInterception(true);
    
    let audioUrl = null;
    
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      if (url.endsWith('.opus') && !audioUrl) {
        audioUrl = url;
        console.log('Found opus file:', audioUrl);
      }
    });
    
    // Navigate to ashreinu.app
    console.log('Navigating to ashreinu.app...');
    await page.goto('https://ashreinu.app', { waitUntil: 'networkidle2' });
    
    // Wait for audio player to load
    console.log('Waiting for audio player...');
    await page.waitForSelector("#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container", { timeout: 30000 });
    
    // If we didn't catch the opus file in network requests, try to extract it from the audio element
    if (!audioUrl) {
      console.log('Trying to extract audio URL from page...');
      audioUrl = await page.evaluate(() => {
        const audioElement = document.querySelector('audio');
        return audioElement ? audioElement.src : null;
      });
    }
    
    await browser.close();
    
    if (audioUrl) {
      console.log('Returning audio URL:', audioUrl);
      return res.json({ success: true, audioUrl });
    } else {
      console.log('No audio URL found');
      return res.status(404).json({ success: false, message: 'No audio file found' });
    }
  } catch (error) {
    console.error('Error fetching audio:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
