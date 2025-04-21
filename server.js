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
        const response = await fetch(\`/download?url=\${encodeURIComponent(url)}\`);
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
        const response = await fetch(\`/after/\${subpath}\`);
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
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
