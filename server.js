/**
 * Alternative approach using built-in Chromium from puppeteer-core
 */
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Function to download a file
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
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

// Route to directly fetch opus files by URL
app.get('/fetch-audio-direct', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL parameter is required' });
  }
  
  try {
    console.log('Downloading audio from URL:', url);
    const audioData = await downloadFile(url);
    
    // Set appropriate headers for audio file
    res.setHeader('Content-Type', 'audio/opus');
    res.setHeader('Content-Disposition', 'attachment; filename="audio.opus"');
    res.send(audioData);
  } catch (error) {
    console.error('Error downloading audio:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Simple route to check server status
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Route to fetch opus file without puppeteer
app.get('/fetch-audio-proxy', async (req, res) => {
  const { site } = req.query;
  const targetSite = site || 'https://ashreinu.app';
  
  try {
    console.log('Proxying request to:', targetSite);
    
    // Simple proxy approach - no browser needed
    const response = await fetch(targetSite);
    const html = await response.text();
    
    // Look for .opus URLs in the HTML
    const opusRegex = /https?:\/\/[^"']+\.opus/g;
    const matches = html.match(opusRegex);
    
    if (matches && matches.length > 0) {
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
    console.error('Error fetching audio:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Alternative server running on port ${PORT}`);
});
