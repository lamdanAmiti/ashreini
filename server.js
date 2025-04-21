// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Download route
app.get('/download', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    const opusUrl = await getOpusFileUrl(url);
    if (opusUrl) {
      return res.json({ success: true, url: opusUrl });
    } else {
      return res.status(404).json({ error: 'Opus file not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to get opus file' });
  }
});

// Process all subpaths for ashreinu.app
app.get('/after/*', async (req, res) => {
  const subPath = req.params[0];
  if (!subPath) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }
  
  const url = `https://ashreinu.app/${subPath}`;
  
  try {
    const opusUrls = await processAllOpusFiles(url);
    if (opusUrls && opusUrls.length > 0) {
      return res.json({ success: true, urls: opusUrls });
    } else {
      return res.status(404).json({ error: 'No opus files found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to process opus files' });
  }
});

// Function to get the opus file URL using Puppeteer
async function getOpusFileUrl(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait for the audio element to be available
    await page.waitForSelector('audio', { timeout: 10000 });
    
    // Extract the opus file URL
    const opusUrl = await page.evaluate(() => {
      const audioElement = document.querySelector('audio');
      if (audioElement && audioElement.src) {
        return audioElement.src;
      }
      
      // If audio element doesn't have src directly, look for sources
      const sourceElement = document.querySelector('audio source[type="audio/ogg"]');
      if (sourceElement && sourceElement.src) {
        return sourceElement.src;
      }
      
      return null;
    });
    
    return opusUrl;
  } catch (error) {
    console.error('Error in getOpusFileUrl:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Function to process all opus files in a page
async function processAllOpusFiles(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Extract all possible opus file URLs
    const opusUrls = await page.evaluate(() => {
      // Look for audio elements
      const audioElements = Array.from(document.querySelectorAll('audio'));
      const sourceElements = Array.from(document.querySelectorAll('audio source[type="audio/ogg"]'));
      
      // Look for any links that might be opus files
      const links = Array.from(document.querySelectorAll('a[href$=".opus"]'));
      
      const urls = [];
      
      // Get sources from audio elements
      audioElements.forEach(audio => {
        if (audio.src && audio.src.includes('.opus')) {
          urls.push(audio.src);
        }
      });
      
      // Get sources from source elements
      sourceElements.forEach(source => {
        if (source.src) {
          urls.push(source.src);
        }
      });
      
      // Get URLs from links
      links.forEach(link => {
        if (link.href) {
          urls.push(link.href);
        }
      });
      
      // Remove duplicates
      return [...new Set(urls)];
    });
    
    return opusUrls;
  } catch (error) {
    console.error('Error in processAllOpusFiles:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Lecture Downloader server running at http://localhost:${port}`);
});
