/**
 * Proxy server for ashreinu.app that injects a download button
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_SITE = 'https://ashreinu.app';

// Serve our static files
app.use(express.static('public'));

// Function to modify HTML content and inject our download button
const modifyResponse = (body, req) => {
  try {
    // Load HTML into cheerio
    const $ = cheerio.load(body);
    
    // Find the audio player controls container
    const controlsContainer = $('#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container');
    
    if (controlsContainer.length) {
      console.log('Found controls container, injecting download button');
      
      // Add our download button
      controlsContainer.append(`
        <button id="download-button" class="control-button" 
                style="background-color: #4CAF50; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; margin-left: 10px;">
          Download for Offline
        </button>
      `);
      
      // Add our script to find and download the opus file
      $('body').append(`
        <script>
          (function() {
            // Wait for page to fully load
            window.addEventListener('load', function() {
              // Find the download button we injected
              const downloadButton = document.getElementById('download-button');
              if (!downloadButton) return;
              
              downloadButton.addEventListener('click', async function() {
                // Find the audio element
                const audioElements = document.querySelectorAll('audio');
                if (!audioElements || audioElements.length === 0) {
                  alert('No audio element found on the page');
                  return;
                }
                
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
            });
          })();
        </script>
      `);
    } else {
      console.log('Controls container not found');
    }
    
    return $.html();
  } catch (error) {
    console.error('Error modifying response:', error);
    return body;
  }
};

// Create a proxy middleware with response intercept
const ashreinu = createProxyMiddleware({
  target: TARGET_SITE,
  changeOrigin: true,
  selfHandleResponse: true, // We'll handle the response ourselves
  onProxyRes: (proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'] || '';
    let body = [];
    
    // Collect response body
    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });
    
    // When the response is complete
    proxyRes.on('end', () => {
      body = Buffer.concat(body).toString();
      
      // Only modify HTML responses
      if (contentType.includes('text/html')) {
        body = modifyResponse(body, req);
      }
      
      // Set headers and send response
      Object.keys(proxyRes.headers).forEach(key => {
        // Skip content-length as it will be incorrect after our modifications
        if (key !== 'content-length') {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      res.end(body);
    });
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
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch opus: ${response.status}`);
    }
    
    // Get filename from URL or use default
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'audio.opus';
    
    // Set response headers for download
    res.setHeader('Content-Type', 'audio/opus');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe the response to the client
    response.body.pipe(res);
  } catch (error) {
    console.error('Error downloading opus:', error);
    res.status(500).send(`Error downloading audio: ${error.message}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Use the proxy for all other routes
app.use('/', ashreinu);

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
