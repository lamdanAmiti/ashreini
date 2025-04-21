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
    
    // Get list of installed browsers to help with debugging
    try {
      const { execSync } = require('child_process');
      const browsersOutput = execSync('npx puppeteer browsers list').toString();
      console.log('Installed browsers:', browsersOutput);
    } catch (err) {
      console.log('Error listing browsers:', err.message);
    }
    
    // Launch puppeteer with no-sandbox mode for Render environment
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

// Route to fetch opus file without puppeteer
app.get('/fetch-audio-proxy', async (req, res) => {
  const targetSite = 'https://ashreinu.app';
  
  try {
    console.log('Proxying request to:', targetSite);
    
    // Simple proxy approach - no browser needed
    const response = await fetch(targetSite);
    const html = await response.text();
    
    // Look for .opus URLs in the HTML
    const opusRegex = /https?:\/\/[^"']+\.opus/g;
    const matches = html.match(opusRegex);
    
    if (matches && matches.length > 0) {
      console.log('Found audio URLs:', matches);
      return res.json({ 
        success: true, 
        audioUrl: matches[0],
        allMatches: matches 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'No audio files found on the page' 
      });
    }
  } catch (error) {
    console.error('Error fetching audio by proxy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route to directly download an opus file by URL
app.get('/download-opus', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL parameter is required' });
  }
  
  try {
    console.log('Downloading opus from URL:', url);
    const opusResponse = await fetch(url);
    
    if (!opusResponse.ok) {
      throw new Error(`Failed to fetch opus: ${opusResponse.status}`);
    }
    
    const contentType = opusResponse.headers.get('content-type');
    const contentDisposition = opusResponse.headers.get('content-disposition') || 'attachment; filename="audio.opus"';
    
    res.setHeader('Content-Type', contentType || 'audio/opus');
    res.setHeader('Content-Disposition', contentDisposition);
    
    // Pipe the response directly to the client
    opusResponse.body.pipe(res);
  } catch (error) {
    console.error('Error downloading opus:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Diagnostic endpoint to check environment
app.get('/diagnostics', async (req, res) => {
  try {
    const diagnostics = {
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        NODE_ENV: process.env.NODE_ENV,
        PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR || 'not set'
      },
      nodeVersion: process.version,
      puppeteerVersion: require('puppeteer/package.json').version,
      cwd: process.cwd(),
      files: {
        browserDebugExists: fs.existsSync(path.join(__dirname, 'browser-debug.json')),
        chromePathExists: fs.existsSync(path.join(__dirname, 'chrome-path.txt'))
      }
    };
    
    // Try to read debug info
    if (diagnostics.files.browserDebugExists) {
      try {
        diagnostics.browserDebug = JSON.parse(
          fs.readFileSync(path.join(__dirname, 'browser-debug.json'), 'utf8')
        );
      } catch (e) {
        diagnostics.browserDebugError = e.message;
      }
    }
    
    // Try to read chrome path
    if (diagnostics.files.chromePathExists) {
      try {
        diagnostics.chromePath = fs.readFileSync(
          path.join(__dirname, 'chrome-path.txt'), 'utf8'
        ).trim();
      } catch (e) {
        diagnostics.chromePathError = e.message;
      }
    }
    
    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if Chrome is installed
app.get('/check-chrome', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const result = execSync('npx puppeteer browsers list').toString();
    res.json({ success: true, message: 'Chrome status', browsers: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
