/**
 * Simple server version - No Puppeteer dependency
 * Direct HTTP requests to get audio files from ashreinu.app
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Function to download a file
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

// Simple proxy approach - fetch and parse HTML directly
app.get('/fetch-audio', async (req, res) => {
  const targetSite = 'https://ashreinu.app';
  
  try {
    console.log('Proxying request to:', targetSite);
    
    // Make a simple HTTP request to the target site
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
      // If no opus files found in HTML, check network requests
      console.log('No audio URLs found in HTML. Trying another approach...');
      
      // List of common paths to check
      const possiblePaths = [
        '/assets/audio/main.opus',
        '/audio/main.opus',
        '/audio/latest.opus',
        '/content/audio.opus'
      ];
      
      // Try each path
      for (const path of possiblePaths) {
        try {
          const audioUrl = `${targetSite}${path}`;
          // Just check if the URL exists
          const audioCheck = await fetch(audioUrl, { method: 'HEAD' });
          if (audioCheck.ok) {
            return res.json({ 
              success: true, 
              audioUrl: audioUrl
            });
          }
        } catch (err) {
          // Continue to next path
          console.log(`Path ${path} not found`);
        }
      }
      
      return res.status(404).json({ 
        success: false, 
        message: 'No audio files found on the page' 
      });
    }
  } catch (error) {
    console.error('Error fetching audio:', error);
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

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple server running on port ${PORT}`);
});
