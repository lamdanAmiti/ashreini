// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create index.html if it doesn't exist
const indexHtmlPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lecture Downloader</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #2c3e50;
      text-align: center;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 5px;
      padding: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .input-group {
      margin-bottom: 15px;
    }
    input[type="text"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
      font-size: 16px;
    }
    button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #2980b9;
    }
    .results {
      margin-top: 20px;
      display: none;
    }
    .loading {
      text-align: center;
      display: none;
    }
    .error {
      color: #e74c3c;
      font-weight: bold;
      display: none;
    }
    .file-list {
      list-style-type: none;
      padding: 0;
    }
    .file-list li {
      margin-bottom: 10px;
      padding: 10px;
      background-color: #eee;
      border-radius: 4px;
    }
    .file-list a {
      color: #3498db;
      text-decoration: none;
      font-weight: bold;
    }
    .file-list a:hover {
      text-decoration: underline;
    }
    .tabs {
      display: flex;
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      background-color: #eee;
      border: 1px solid #ddd;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      margin-right: 5px;
    }
    .tab.active {
      background-color: #f9f9f9;
      font-weight: bold;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
  </style>
</head>
<body>
  <h1>Lecture Downloader</h1>
  
  <div class="tabs">
    <div class="tab active" data-tab="single">Single Download</div>
    <div class="tab" data-tab="multiple">Multiple Downloads</div>
  </div>
  
  <div class="container">
    <div class="tab-content active" id="single-tab">
      <h2>Download Single Opus File</h2>
      <div class="input-group">
        <label for="url">Enter ashreinu.app URL:</label>
        <input type="text" id="url" placeholder="https://ashreinu.app/..." required>
      </div>
      <button id="download-btn">Download Opus File</button>
      
      <div class="loading" id="loading-single">
        <p>Processing... Please wait</p>
      </div>
      
      <div class="error" id="error-single"></div>
      
      <div class="results" id="results-single">
        <h3>Download Link:</h3>
        <div id="download-link"></div>
      </div>
    </div>
    
    <div class="tab-content" id="multiple-tab">
      <h2>Download Multiple Opus Files</h2>
      <div class="input-group">
        <label for="subpath">Enter ashreinu.app subpath:</label>
        <input type="text" id="subpath" placeholder="Enter path after ashreinu.app/" required>
      </div>
      <button id="process-btn">Process All Files</button>
      
      <div class="loading" id="loading-multiple">
        <p>Processing multiple files... This may take a minute</p>
      </div>
      
      <div class="error" id="error-multiple"></div>
      
      <div class="results" id="results-multiple">
        <h3>Download Links:</h3>
        <ul class="file-list" id="file-list"></ul>
      </div>
    </div>
  </div>

  <script>
    // Get base URL of server
    const baseUrl = window.location.origin;
    
    // Tab functionality
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Show the corresponding tab content
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(\`\${tabId}-tab\`).classList.add('active');
      });
    });

    // Single download functionality
    document.getElementById('download-btn').addEventListener('click', async () => {
      const url = document.getElementById('url').value.trim();
      
      if (!url) {
        document.getElementById('error-single').textContent = 'Please enter a valid URL';
        document.getElementById('error-single').style.display = 'block';
        return;
      }
      
      // Show loading and hide previous results
      document.getElementById('loading-single').style.display = 'block';
      document.getElementById('results-single').style.display = 'none';
      document.getElementById('error-single').style.display = 'none';
      
      try {
        const response = await fetch(\`\${baseUrl}/download?url=\${encodeURIComponent(url)}\`);
        const data = await response.json();
        
        if (data.success) {
          const downloadLinkElement = document.getElementById('download-link');
          downloadLinkElement.innerHTML = \`
            <a href="\${data.url}" target="_blank">
              \${data.url}
            </a>
            <p>
              <a href="\${data.url}" download class="download-btn">
                <button>Direct Download</button>
              </a>
            </p>
          \`;
          document.getElementById('results-single').style.display = 'block';
        } else {
          document.getElementById('error-single').textContent = data.error || 'Failed to fetch opus file';
          document.getElementById('error-single').style.display = 'block';
        }
      } catch (error) {
        document.getElementById('error-single').textContent = 'An error occurred while processing your request';
        document.getElementById('error-single').style.display = 'block';
      } finally {
        document.getElementById('loading-single').style.display = 'none';
      }
    });

    // Multiple downloads functionality
    document.getElementById('process-btn').addEventListener('click', async () => {
      const subpath = document.getElementById('subpath').value.trim();
      
      if (!subpath) {
        document.getElementById('error-multiple').textContent = 'Please enter a valid subpath';
        document.getElementById('error-multiple').style.display = 'block';
        return;
      }
      
      // Show loading and hide previous results
      document.getElementById('loading-multiple').style.display = 'block';
      document.getElementById('results-multiple').style.display = 'none';
      document.getElementById('error-multiple').style.display = 'none';
      
      try {
        const response = await fetch(\`\${baseUrl}/after/\${subpath}\`);
        const data = await response.json();
        
        if (data.success && data.urls && data.urls.length > 0) {
          const fileListElement = document.getElementById('file-list');
          fileListElement.innerHTML = '';
          
          data.urls.forEach((url, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = \`
              <div>
                <strong>File \${index + 1}:</strong>
                <a href="\${url}" target="_blank">\${url}</a>
                <p>
                  <a href="\${url}" download>
                    <button>Download</button>
                  </a>
                </p>
              </div>
            \`;
            fileListElement.appendChild(listItem);
          });
          
          document.getElementById('results-multiple').style.display = 'block';
        } else {
          document.getElementById('error-multiple').textContent = data.error || 'No opus files found';
          document.getElementById('error-multiple').style.display = 'block';
        }
      } catch (error) {
        document.getElementById('error-multiple').textContent = 'An error occurred while processing your request';
        document.getElementById('error-multiple').style.display = 'block';
      } finally {
        document.getElementById('loading-multiple').style.display = 'none';
      }
    });
  </script>
</body>
</html>`;
  fs.writeFileSync(indexHtmlPath, indexHtml);
}

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
  
  console.log(`[${new Date().toISOString()}] Download request started for URL: ${url}`);
  
  try {
    // Add logs to track progress
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial response that we're starting
    console.log(`[${new Date().toISOString()}] Starting Puppeteer process...`);
    
    const opusUrl = await getOpusFileUrl(url);
    if (opusUrl) {
      console.log(`[${new Date().toISOString()}] Successfully found opus URL: ${opusUrl}`);
      return res.json({ success: true, url: opusUrl, logs: `Successfully found opus URL: ${opusUrl}` });
    } else {
      console.log(`[${new Date().toISOString()}] No opus file found`);
      return res.status(404).json({ error: 'Opus file not found', logs: 'No opus file found after complete page scan' });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    return res.status(500).json({ error: 'Failed to get opus file', logs: `Error: ${error.message}` });
  }
});

// Process all subpaths for ashreinu.app
app.get('/after/*', async (req, res) => {
  const subPath = req.params[0];
  if (!subPath) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }
  
  const url = `https://ashreinu.app/${subPath}`;
  console.log(`[${new Date().toISOString()}] Processing subpath request for: ${url}`);
  
  try {
    console.log(`[${new Date().toISOString()}] Starting to process all opus files...`);
    const opusUrls = await processAllOpusFiles(url);
    if (opusUrls && opusUrls.length > 0) {
      console.log(`[${new Date().toISOString()}] Found ${opusUrls.length} opus files`);
      return res.json({ 
        success: true, 
        urls: opusUrls,
        logs: `Successfully found ${opusUrls.length} opus files` 
      });
    } else {
      console.log(`[${new Date().toISOString()}] No opus files found`);
      return res.status(404).json({ 
        error: 'No opus files found',
        logs: 'No opus files found after complete page scan' 
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /after:`, error);
    return res.status(500).json({ 
      error: 'Failed to process opus files',
      logs: `Error: ${error.message}` 
    });
  }
});

// Function to get the opus file URL using Puppeteer
async function getOpusFileUrl(url) {
  console.log(`[${new Date().toISOString()}] Launching Puppeteer browser...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
  
  try {
    console.log(`[${new Date().toISOString()}] Browser launched, creating new page...`);
    const page = await browser.newPage();
    
    // Set a longer timeout for navigation
    console.log(`[${new Date().toISOString()}] Navigating to URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // 60 seconds timeout
    });
    
    console.log(`[${new Date().toISOString()}] Page loaded, waiting for audio element...`);
    
    // Wait for the audio element to be available with longer timeout
    await page.waitForSelector('audio', { timeout: 30000 });
    
    console.log(`[${new Date().toISOString()}] Audio element found, extracting source...`);
    
    // Extract the opus file URL
    const opusUrl = await page.evaluate(() => {
      console.log('Evaluating page for audio sources...');
      
      // Check for direct audio src
      const audioElement = document.querySelector('audio');
      if (audioElement && audioElement.src) {
        console.log('Found direct audio src:', audioElement.src);
        return audioElement.src;
      }
      
      // Check for source elements inside audio
      const sourceElements = document.querySelectorAll('audio source');
      for (const source of sourceElements) {
        if (source.src) {
          console.log('Found audio source:', source.src);
          return source.src;
        }
      }
      
      // Look specifically for opus sources
      const opusSource = document.querySelector('audio source[type="audio/ogg"]');
      if (opusSource && opusSource.src) {
        console.log('Found opus source:', opusSource.src);
        return opusSource.src;
      }
      
      // If no direct sources found, check the page for opus file links
      const links = document.querySelectorAll('a[href*=".opus"]');
      if (links.length > 0) {
        console.log('Found opus link:', links[0].href);
        return links[0].href;
      }
      
      console.log('No audio sources found');
      return null;
    });
    
    console.log(`[${new Date().toISOString()}] Opus URL extraction result: ${opusUrl || 'Not found'}`);
    return opusUrl;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in getOpusFileUrl:`, error);
    throw error;
  } finally {
    console.log(`[${new Date().toISOString()}] Closing browser...`);
    await browser.close();
  }
}

// Function to process all opus files in a page
async function processAllOpusFiles(url) {
  console.log(`[${new Date().toISOString()}] Launching Puppeteer browser for multiple files...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
  
  try {
    console.log(`[${new Date().toISOString()}] Browser launched, creating new page...`);
    const page = await browser.newPage();
    
    // Enable console log from the browser to server
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    
    console.log(`[${new Date().toISOString()}] Navigating to URL: ${url}`);
    // Set a longer timeout for navigation
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // 60 seconds timeout
    });
    
    console.log(`[${new Date().toISOString()}] Page loaded, extracting all opus file URLs...`);
    
    // Extract all possible opus file URLs
    const opusUrls = await page.evaluate(() => {
      console.log('Evaluating page for all audio sources...');
      
      // Look for audio elements
      const audioElements = Array.from(document.querySelectorAll('audio'));
      console.log(`Found ${audioElements.length} audio elements`);
      
      // Look for source elements
      const sourceElements = Array.from(document.querySelectorAll('audio source'));
      console.log(`Found ${sourceElements.length} source elements`);
      
      // Look specifically for opus sources
      const opusSources = Array.from(document.querySelectorAll('audio source[type="audio/ogg"]'));
      console.log(`Found ${opusSources.length} opus source elements`);
      
      // Look for any links that might be opus files
      const links = Array.from(document.querySelectorAll('a[href*=".opus"]'));
      console.log(`Found ${links.length} links to opus files`);
      
      const urls = [];
      
      // Get sources from audio elements
      audioElements.forEach((audio, index) => {
        if (audio.src) {
          console.log(`Audio element ${index+1} src:`, audio.src);
          urls.push(audio.src);
        } else {
          console.log(`Audio element ${index+1} has no src attribute`);
        }
      });
      
      // Get sources from source elements
      sourceElements.forEach((source, index) => {
        if (source.src) {
          console.log(`Source element ${index+1} src:`, source.src);
          urls.push(source.src);
        } else {
          console.log(`Source element ${index+1} has no src attribute`);
        }
      });
      
      // Get URLs from links
      links.forEach((link, index) => {
        if (link.href) {
          console.log(`Link ${index+1} href:`, link.href);
          urls.push(link.href);
        } else {
          console.log(`Link ${index+1} has no href attribute`);
        }
      });
      
      // Special handling for ashreinu.app - check for audio JSON data
      try {
        // If there's an audio player, try to check for data in script tags
        const scripts = Array.from(document.querySelectorAll('script:not([src])'));
        scripts.forEach((script, index) => {
          if (script.textContent.includes('audio') && script.textContent.includes('url')) {
            console.log(`Checking script ${index+1} for audio data...`);
            try {
              // Try to extract JSON objects that might contain audio URLs
              const content = script.textContent;
              const jsonStart = content.indexOf('{');
              const jsonEnd = content.lastIndexOf('}') + 1;
              
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const jsonStr = content.substring(jsonStart, jsonEnd);
                try {
                  const data = JSON.parse(jsonStr);
                  console.log(`Found potential audio data in script ${index+1}`);
                  
                  // Check for audio URL patterns
                  const findAudioUrls = (obj, path = '') => {
                    if (!obj || typeof obj !== 'object') return;
                    
                    Object.keys(obj).forEach(key => {
                      const value = obj[key];
                      const newPath = path ? `${path}.${key}` : key;
                      
                      if (typeof value === 'string' && 
                          (value.includes('.opus') || 
                           value.includes('.mp3') || 
                           value.includes('audio') ||
                           key.includes('audio') ||
                           key.includes('url'))) {
                        console.log(`Found potential audio URL at ${newPath}:`, value);
                        urls.push(value);
                      } else if (typeof value === 'object') {
                        findAudioUrls(value, newPath);
                      }
                    });
                  };
                  
                  findAudioUrls(data);
                } catch (e) {
                  console.log(`Error parsing JSON from script ${index+1}:`, e.message);
                }
              }
            } catch (e) {
              console.log(`Error processing script ${index+1}:`, e.message);
            }
          }
        });
      } catch (e) {
        console.log('Error searching for audio data in scripts:', e.message);
      }
      
      // Filter out non-opus URLs and duplicates
      const opusUrls = urls.filter(url => 
        url.includes('.opus') || 
        url.includes('.ogg') || 
        url.includes('audio/') ||
        url.includes('/audio')
      );
      
      console.log(`Found ${opusUrls.length} unique opus URLs`);
      
      // Remove duplicates
      return [...new Set(opusUrls)];
    });
    
    console.log(`[${new Date().toISOString()}] Extracted ${opusUrls.length} opus URLs`);
    return opusUrls;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in processAllOpusFiles:`, error);
    throw error;
  } finally {
    console.log(`[${new Date().toISOString()}] Closing browser...`);
    await browser.close();
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Lecture Downloader server running at http://localhost:${port}`);
});
