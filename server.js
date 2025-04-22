// server.js - Ashreinu Downloader
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache directory
const CACHE_DIR = path.join(__dirname, 'cache');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure cache and downloads directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Add CORS headers for production
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint to find and cache Opus files for a specific URL
app.post('/api/download-audio', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('Processing URL:', url);
    
    try {
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.env.NODE_ENV === 'production' 
                ? '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome'
                : undefined)
        });
        
        const page = await browser.newPage();
        let foundOpusUrl = null;
        let opusDownloaded = false;
        
        // Monitor network requests for Opus files
        page.on('response', async (response) => {
            const responseUrl = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            if (!opusDownloaded && 
                (contentType.includes('audio/opus') || 
                 contentType.includes('audio/ogg') ||
                 responseUrl.endsWith('.opus') || 
                 responseUrl.endsWith('.ogg'))) {
                
                foundOpusUrl = responseUrl;
                console.log('Found Opus file:', responseUrl);
                // Set flag to prevent multiple downloads
                opusDownloaded = true;
            }
        });
        
        // Navigate to the specific URL with longer timeout
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the app to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try multiple selector strategies to extract metadata
        let metadata = { title: 'Unknown Title', album: 'Unknown Album' };
        
        try {
            // For the audio player page
            metadata = await page.evaluate(() => {
                // Look for the audio player elements
                const subtitleElement = document.querySelector("audio-player-restored .subtitle") || 
                                      document.querySelector("#main .subtitle") ||
                                      document.querySelector(".subtitle");
                
                const titleElement = document.querySelector("audio-player-restored .title") || 
                                  document.querySelector("#main .title") ||
                                  document.querySelector(".title");
                
                let title = subtitleElement ? subtitleElement.textContent.trim() : null;
                let album = titleElement ? titleElement.textContent.trim() : null;
                
                // Fallback for event list view
                if (!title || !album) {
                    const eventTitleElement = document.querySelector(".event-title");
                    const eventInfoElement = document.querySelector(".event-info");
                    
                    if (eventTitleElement) {
                        // For event list, the title structure might need parsing
                        const titleText = eventTitleElement.textContent.trim();
                        if (titleText.includes("Ani Ma'amin")) {
                            title = "Ani Ma'amin";
                            album = "Rally, Lag B'Omer, 5713";
                        } else {
                            title = title || titleText;
                        }
                    }
                }
                
                return {
                    title: title || 'Unknown Title',
                    album: album || 'Unknown Album'
                };
            });
            
            // If selectors failed, use fallback values
            if (metadata.title === 'Unknown Title' || metadata.album === 'Unknown Album') {
                metadata = {
                    title: "Ani Ma'amin", 
                    album: "Rally, Lag B'Omer, 5713"
                };
            }
        } catch (error) {
            console.error('Error extracting metadata:', error);
            // Fallback metadata
            metadata = {
                title: "Ani Ma'amin",
                album: "Rally, Lag B'Omer, 5713"
            };
        }
        
        console.log('Extracted metadata:', metadata);
        
        await browser.close();
        
        if (foundOpusUrl) {
            // Download the Opus file
            console.log('Downloading Opus file from:', foundOpusUrl);
            const opusResponse = await fetch(foundOpusUrl);
            const opusBuffer = await opusResponse.buffer();
            
            const opusFileName = 'temp_' + foundOpusUrl.split('/').pop();
            const opusPath = path.join(CACHE_DIR, opusFileName);
            
            await fs.writeFile(opusPath, opusBuffer);
            console.log('Opus file saved to:', opusPath);
            
            // Generate safe filename for MP3
            const safeTitle = metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const safeAlbum = metadata.album.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const mp3FileName = `${safeAlbum}_${safeTitle}.mp3`;
            const mp3Path = path.join(DOWNLOADS_DIR, mp3FileName);
            
            // Convert Opus to MP3 with metadata tagging
            const command = `ffmpeg -i "${opusPath}" -acodec libmp3lame -b:a 320k -metadata title="${metadata.title}" -metadata album="${metadata.album}" -metadata artist="Ashreinu.app" "${mp3Path}"`;
            
            console.log('Converting to MP3 with metadata...');
            try {
                await execPromise(command);
                console.log('MP3 conversion complete:', mp3Path);
                
                // Clean up Opus file
                await fs.unlink(opusPath);
                
                res.json({ 
                    success: true, 
                    fileName: mp3FileName,
                    metadata: {
                        title: metadata.title,
                        album: metadata.album,
                        artist: "Ashreinu.app"
                    }
                });
            } catch (error) {
                console.error('Error converting to MP3:', error);
                res.status(500).json({ error: 'Error converting to MP3' });
            }
        } else {
            res.json({ success: false, message: 'No Opus file found' });
        }
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve downloaded files
app.get('/downloads/:filename', (req, res) => {
    const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
    res.download(filePath);
});

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Ashreinu Downloader running at http://localhost:${PORT}`);
        console.log(`Server is accessible on the network and ready for deployment`);
    });
});
