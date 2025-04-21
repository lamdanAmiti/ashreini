/**
 * Simple proxy server for ashreinu.app that works without external dependencies
 * This version uses only Express and built-in Node.js modules
 */
const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_SITE = 'https://ashreinu.app';

// Serve static files
app.use(express.static('public'));

// Function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirects
        return makeRequest(res.headers.location, options).then(resolve).catch(reject);
      }
      
      // Collect response body
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', reject);
  });
}

// Function to modify HTML and inject download button
function injectDownloadButton(html) {
  try {
    // Very simple HTML manipulation - this is error-prone but avoids requiring cheerio
    const controlsContainerPattern = /<div class="controls-container ng-star-inserted">[\s\S]*?<div class="control-buttons-container">([\s\S]*?)<\/div>/;
    const match = html.match(controlsContainerPattern);
    
    if (match) {
      console.log('Found controls container, injecting download button');
      
      // Add our download button
      const downloadButton = `
        <button id="download-button" class="control-button" 
                style="background-color: #4CAF50; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; margin-left: 10px;">
          Download for Offline
        </button>
      `;
      
      // Replace the closing div with our button + closing div
      html = html.replace(
        /<\/div>(?=[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?controls-container)/,
        downloadButton + '</div>'
      );
      
      // Add our script to find and download opus files
      const downloadScript = `
        <script>
          (function() {
            // Wait for page to fully load
            window.addEventListener('load', function() {
              // Check periodically for the audio element (it might be loaded dynamically)
              const checkInterval = setInterval(function() {
                // Find the download button we injected
                const downloadButton = document.getElementById('download-button');
                if (!downloadButton) return;
                
                // Find any audio elements
                const audioElements = document.querySelectorAll('audio');
                if (!audioElements || audioElements.length === 0) return;
                
                // We found both audio element and our button, clear interval
                clearInterval(checkInterval);
                
                // Add click handler to download button
                downloadButton.addEventListener('click', function() {
                  // Get the current audio source
                  const audioSrc = audioElements[0].src;
                  if (!audioSrc) {
                    alert('No audio source found');
                    return;
                  }
                  
                  // Check if it's an opus file
                  if (!audioSrc.endsWith('.opus')) {
                    alert('Current audio is not an opus file');
                    return;
                  }
                  
                  // Send to our server endpoint to handle download and caching
                  window.location.href = '/download-opus?url=' + encodeURIComponent(audioSrc);
                });
                
                console.log('Download button initialized');
              }, 1000); // Check every second
            });
            
            // Also intercept network requests to find opus files
            const originalFetch = window.fetch;
            window.fetch = function() {
              const fetchCall = originalFetch.apply(this, arguments);
              
              // Check if this is an opus file
              if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].endsWith('.opus')) {
                console.log('Detected opus file:', arguments[0]);
                
                // Store the URL in localStorage for our download button to use
                localStorage.setItem('lastOpusUrl', arguments[0]);
              }
              
              return fetchCall;
            };
          })();
        </script>
      `;
      
      // Add the script to the end of the body
      html = html.replace('</body>', downloadScript + '</body>');
    } else {
      console.log('Controls container not found');
    }
    
    return html;
  } catch (error) {
    console.error('Error injecting download button:', error);
    return html;
  }
}

// Main route for proxying ashreinu.app
app.get('/', async (req, res) => {
  try {
    console.log('Proxying request to ashreinu.app');
    
    // Fetch the main page
    const response = await makeRequest(TARGET_SITE, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
      }
    });
    
    if (response.statusCode !== 200) {
      return res.status(response.statusCode).send('Failed to fetch ashreinu.app');
    }
    
    // Get content type and check if it's HTML
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      // Convert buffer to string
      let html = response.body.toString();
      
      // Inject our download button
      html = injectDownloadButton(html);
      
      // Set headers and send response
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } else {
      // For non-HTML responses, just pass through
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      return res.send(response.body);
    }
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send('Error proxying request: ' + error.message);
  }
});

// Route to download opus files
app.get('/download-opus', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    console.log('Downloading opus from URL:', url);
    
    // Make the request
    const audioResponse = await makeRequest(url);
    
    if (audioResponse.statusCode !== 200) {
      throw new Error(`Failed to fetch opus: ${audioResponse.statusCode}`);
    }
    
    // Get filename from URL or use default
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'audio.opus';
    
    // Set response headers for download
    res.setHeader('Content-Type', 'audio/opus');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send the audio data
    const stream = new Readable();
    stream.push(audioResponse.body);
    stream.push(null);
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading opus:', error);
    res.status(500).send(`Error downloading audio: ${error.message}`);
  }
});

// Proxy all other requests
app.use((req, res) => {
  const targetUrl = TARGET_SITE + req.url;
  console.log('Proxying request to:', targetUrl);
  
  // Forward the request to ashreinu.app
  const protocol = targetUrl.startsWith('https') ? https : http;
  const proxyReq = protocol.request(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: new URL(TARGET_SITE).host
    }
  }, (proxyRes) => {
    // Copy status code and headers
    res.statusCode = proxyRes.statusCode;
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Pipe the response data
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error: ' + error.message);
  });
  
  // If there's request data, pipe it to the proxy request
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple proxy server running on port ${PORT}`);
});
