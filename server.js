// Function to get the opus file URL using Puppeteer
async function getOpusFileUrl(url) {
  console.log(`[${new Date().toISOString()}] Launching Puppeteer browser...`);
  
  // Launch options
  const launchOptions = {
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };
  
  // If we found a Chrome path, use it
  if (chromiumPath) {
    launchOptions.executablePath = chromiumPath;
    console.log(`[${new Date().toISOString()}] Using Chromium at: ${chromiumPath}`);
  } else {
    console.log(`[${new Date().toISOString()}] Using Puppeteer's bundled Chromium`);
  }
  
  try {
    console.log(`[${new Date().toISOString()}] Starting browser launch...`);
    const browser = await puppeteer.launch(launchOptions);
    console.log(`[${new Date().toISOString()}] Browser launched successfully`);
    
    try {
      console.log(`[${new Date().toISOString()}] Creating new page...`);
      const page = await browser.newPage();
      
      // Set a longer timeout for navigation
      console.log(`[${new Date().toISOString()}] Navigating to URL: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 // 60 seconds timeout
      });
      
      console.log(`[${new Date().toISOString()}] Page loaded, searching for audio elements...`);
      
      // Enable console log from the browser to server
      page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
      
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
        
        // Special handling for ashreinu.app
        if (window.location.hostname.includes('ashreinu.app')) {
          console.log('Detected ashreinu.app, checking specific patterns...');
          
          // Try to find media data in script tags
          const scripts = document.querySelectorAll('script:not([src])');
          for (const script of scripts) {
            const content = script.textContent;
            if (content.includes('audio') || content.includes('media') || content.includes('.opus')) {
              console.log('Found script with potential media content');
              
              // Try to find audio URLs in the script content using regex
              const opusMatch = content.match(/https?:[^"']+\.opus/);
              if (opusMatch) {
                console.log('Found opus URL in script:', opusMatch[0]);
                return opusMatch[0];
              }
            }
          }
          
          // Look for window.ashreinu object
          if (typeof window.ashreinu !== 'undefined') {
            console.log('Found ashreinu global object');
            
            try {
              if (window.ashreinu.currentClip && window.ashreinu.currentClip.url) {
                console.log('Found URL in currentClip:', window.ashreinu.currentClip.url);
                return window.ashreinu.currentClip.url;
              }
            } catch (e) {
              console.log('Error accessing ashreinu object:', e.message);
            }
          }
        }
        
        console.log('No audio sources found');
        return null;
      });
      
      console.log(`[${new Date().toISOString()}] Opus URL extraction result: ${opusUrl || 'Not found'}`);
      return opusUrl;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in page operations:`, error);
      throw error;
    } finally {
      console.log(`[${new Date().toISOString()}] Closing browser...`);
      await browser.close();
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error launching browser:`, error);
    console.error(error);
    throw error;
  }
}// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Load the Chromium path if it exists
let chromiumPath = null;
try {
  if (fs.existsSync('./chromium-path.json')) {
    const chromiumInfo = JSON.parse(fs.readFileSync('./chromium-path.json', 'utf8'));
    chromiumPath = chromiumInfo.executablePath;
    console.log(`[${new Date().toISOString()}] Found Chromium path from file: ${chromiumPath}`);
  }
} catch (error) {
  console.error(`[${new Date().toISOString()}] Error loading Chromium path:`, error);
}

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
  
  // Try to find Chrome executable in different locations
  const possibleChromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
    '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome'
  ];
  
  // Find the first path that exists
  let chromePath = null;
  for (const path of possibleChromePaths) {
    try {
      if (fs.existsSync(path)) {
        chromePath = path;
        console.log(`[${new Date().toISOString()}] Found Chrome at: ${chromePath}`);
        break;
      }
    } catch (err) {
      console.log(`[${new Date().toISOString()}] Error checking Chrome path ${path}: ${err.message}`);
    }
  }
  
  // Launch options
  const launchOptions = {
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--safebrowsing-disable-auto-update'
    ]
  };
  
  // If we found a Chrome path, use it
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }
  
  console.log(`[${new Date().toISOString()}] Launching with options:`, JSON.stringify(launchOptions, null, 2));
  
  try {
    const browser = await puppeteer.launch(launchOptions);
    
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
      
      // Try different selectors with a longer timeout
      let audioFound = false;
      
      try {
        // First try to wait for the audio element
        await page.waitForSelector('audio', { timeout: 30000 });
        audioFound = true;
        console.log(`[${new Date().toISOString()}] Audio element found`);
      } catch (audioError) {
        console.log(`[${new Date().toISOString()}] Audio element not found, trying source elements...`);
        try {
          // If no audio element, try to find source elements
          await page.waitForSelector('audio source', { timeout: 10000 });
          audioFound = true;
          console.log(`[${new Date().toISOString()}] Audio source element found`);
        } catch (sourceError) {
          console.log(`[${new Date().toISOString()}] Audio source elements not found, trying links...`);
          try {
            // If no source elements, try to find links to opus files
            await page.waitForSelector('a[href*=".opus"]', { timeout: 10000 });
            audioFound = true;
            console.log(`[${new Date().toISOString()}] Links to opus files found`);
          } catch (linkError) {
            console.log(`[${new Date().toISOString()}] No specific audio elements found, proceeding with page evaluation...`);
          }
        }
      }
      
      console.log(`[${new Date().toISOString()}] Extracting source...`);
      
      // Enable console log from the browser to server
      page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
      
      // Take a screenshot for debugging
      try {
        await page.screenshot({path: 'debug-screenshot.png'});
        console.log(`[${new Date().toISOString()}] Took debug screenshot`);
      } catch (screenshotError) {
        console.log(`[${new Date().toISOString()}] Failed to take debug screenshot: ${screenshotError.message}`);
      }
      
      // Extract the opus file URL
      const opusUrl = await page.evaluate(() => {
        console.log('Evaluating page for audio sources...');
        
        // Debug page content
        console.log('Page title:', document.title);
        
        // Check for direct audio src
        const audioElements = document.querySelectorAll('audio');
        console.log(`Found ${audioElements.length} audio elements`);
        
        if (audioElements.length > 0) {
          for (const audio of audioElements) {
            if (audio.src) {
              console.log('Found direct audio src:', audio.src);
              return audio.src;
            }
          }
        }
        
        // Check for source elements inside audio
        const sourceElements = document.querySelectorAll('audio source');
        console.log(`Found ${sourceElements.length} source elements`);
        
        if (sourceElements.length > 0) {
          for (const source of sourceElements) {
            if (source.src) {
              console.log('Found audio source:', source.src);
              return source.src;
            }
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
        console.log(`Found ${links.length} links to .opus files`);
        
        if (links.length > 0) {
          console.log('Found opus link:', links[0].href);
          return links[0].href;
        }
        
        // Check for embedded media in script tags
        const scripts = document.querySelectorAll('script:not([src])');
        console.log(`Found ${scripts.length} inline script tags`);
        
        for (const script of scripts) {
          const content = script.textContent;
          if (content.includes('audio') || content.includes('media') || content.includes('.opus')) {
            console.log('Found script with potential media content');
            
            // Try to find audio URLs in the script
            const opusMatch = content.match(/https?:[^"']+\.opus/);
            if (opusMatch) {
              console.log('Found opus URL in script:', opusMatch[0]);
              return opusMatch[0];
            }
            
            // Look for any media URL
            const mediaMatch = content.match(/https?:[^"']+\.(mp3|ogg|wav|m4a)/);
            if (mediaMatch) {
              console.log('Found media URL in script:', mediaMatch[0]);
              return mediaMatch[0];
            }
          }
        }
        
        // Special handling for ashreinu.app
        if (window.location.hostname.includes('ashreinu.app')) {
          console.log('Detected ashreinu.app, looking for specific patterns...');
          
          // Check for global variables that might contain media info
          if (typeof window.ashreinu !== 'undefined') {
            console.log('Found ashreinu global object');
            
            // Attempt to find audio data in ashreinu object
            try {
              // Access possible paths based on object structure
              let url = null;
              
              if (window.ashreinu && window.ashreinu.currentClip && window.ashreinu.currentClip.url) {
                url = window.ashreinu.currentClip.url;
                console.log('Found URL in ashreinu.currentClip:', url);
              } else if (window.ashreinu && window.ashreinu.player && window.ashreinu.player.audio && window.ashreinu.player.audio.src) {
                url = window.ashreinu.player.audio.src;
                console.log('Found URL in ashreinu.player.audio:', url);
              }
              
              if (url) return url;
            } catch (err) {
              console.log('Error accessing ashreinu object:', err.message);
            }
          }
          
          // Look for network requests in devtools
          if (typeof window.performance !== 'undefined' && window.performance.getEntries) {
            const resources = window.performance.getEntries();
            console.log(`Found ${resources.length} network resources`);
            
            for (const resource of resources) {
              if (resource.name && (
                resource.name.includes('.opus') || 
                resource.name.includes('.mp3') || 
                resource.name.includes('.ogg') ||
                resource.name.includes('audio/')
              )) {
                console.log('Found audio resource:', resource.name);
                return resource.name;
              }
            }
          }
        }
        
        console.log('No audio sources found');
        return null;
      });
      
      console.log(`[${new Date().toISOString()}] Opus URL extraction result: ${opusUrl || 'Not found'}`);
      return opusUrl;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in page operations:`, error);
      throw error;
    } finally {
      console.log(`[${new Date().toISOString()}] Closing browser...`);
      await browser.close();
    }
  } catch (browserError) {
    console.error(`[${new Date().toISOString()}] Error launching browser:`, browserError);
    throw browserError;
  }
}

// Function to process all opus files in a page
async function processAllOpusFiles(url) {
  console.log(`[${new Date().toISOString()}] Launching Puppeteer browser for multiple files...`);
  
  // Launch options
  const launchOptions = {
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };
  
  // If we found a Chrome path, use it
  if (chromiumPath) {
    launchOptions.executablePath = chromiumPath;
    console.log(`[${new Date().toISOString()}] Using Chromium at: ${chromiumPath}`);
  } else {
    console.log(`[${new Date().toISOString()}] Using Puppeteer's bundled Chromium`);
  }
  
  try {
    console.log(`[${new Date().toISOString()}] Starting browser launch...`);
    const browser = await puppeteer.launch(launchOptions);
    console.log(`[${new Date().toISOString()}] Browser launched successfully`);
    
    try {
      console.log(`[${new Date().toISOString()}] Creating new page...`);
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
        
        // Special handling for ashreinu.app
        if (window.location.hostname.includes('ashreinu.app')) {
          console.log('Detected ashreinu.app, special handling...');
          
          // Check for ashreinu global object
          if (typeof window.ashreinu !== 'undefined') {
            console.log('Found ashreinu global object');
            
            try {
              // Check for playlist
              if (window.ashreinu.playlist && Array.isArray(window.ashreinu.playlist)) {
                console.log(`Found playlist with ${window.ashreinu.playlist.length} items`);
                
                window.ashreinu.playlist.forEach((item, i) => {
                  if (item && item.url) {
                    console.log(`Found URL in playlist item ${i}:`, item.url);
                    urls.push(item.url);
                  }
                });
              }
            } catch (err) {
              console.log('Error accessing ashreinu playlist:', err.message);
            }
          }
          
          // Try to find opus URLs in script tags
          const scripts = Array.from(document.querySelectorAll('script:not([src])'));
          scripts.forEach((script, index) => {
            const content = script.textContent;
            
            if (content.includes('audio') || content.includes('url') || content.includes('.opus')) {
              // Extract opus URLs with regex
              const opusMatches = content.match(/https?:[^"']+\.opus/g);
              if (opusMatches) {
                console.log(`Found ${opusMatches.length} opus URLs in script ${index+1}`);
                opusMatches.forEach(match => urls.push(match));
              }
            }
          });
        }
        
        // Filter out non-audio URLs and duplicates
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
      console.error(`[${new Date().toISOString()}] Error in page operations:`, error);
      throw error;
    } finally {
      console.log(`[${new Date().toISOString()}] Closing browser...`);
      await browser.close();
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error launching browser:`, error);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Lecture Downloader server running at http://localhost:${port}`);
});
