// server.js - Opus File Finder
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// API endpoint to find opus files
app.get('/find-opus', async (req, res) => {
    const websiteUrl = req.query.url;
    
    if (!websiteUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const browser = await puppeteer.launch({ 
            headless: 'new' 
        });
        const page = await browser.newPage();
        
        let opusUrl = null;

        // Set up network monitoring
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            // Just continue all requests
            request.continue();
        });

        page.on('response', async (response) => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            // Check if the response is an opus file
            if (contentType.includes('audio/opus') || 
                contentType.includes('audio/ogg') ||
                url.endsWith('.opus') || 
                url.endsWith('.ogg')) {
                
                if (!opusUrl) {
                    opusUrl = url;
                    console.log('Found Opus file:', url);
                }
            }
        });

        // Navigate to the website
        try {
            await page.goto(websiteUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            // Wait a bit more for any delayed requests
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } catch (error) {
            console.log('Navigation error:', error.message);
        }

        await browser.close();

        if (opusUrl) {
            res.json({ 
                success: true, 
                opusUrl: opusUrl 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No Opus files found' 
            });
        }

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'An error occurred while searching for Opus files',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
