const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const app = express();

// Use the PORT environment variable provided by the cloud server
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/process-url', async (req, res) => {
    const urlToProcess = req.body.url || 'https://ashreinu.app';
    const opusUrl = await findOpusUrl(urlToProcess);
    
    if (opusUrl) {
        res.send({ 
            streamUrl: opusUrl,
            downloadLink: opusUrl // For direct download, we'll use the opus URL directly
        });
    } else {
        res.status(404).send({ error: 'No opus file found' });
    }
});

async function findOpusUrl(url) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36");
    
    let foundOpus = false;
    let opusUrl = '';
    
    page.on('response', async (response) => {
        const responseUrl = response.url();
        if (!foundOpus && responseUrl.includes('.opus')) {
            opusUrl = responseUrl;
            foundOpus = true;
        }
    });
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Wait for the audio player to be available
        await page.waitForSelector('#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container', { timeout: 10000 });
        
        // Wait some additional time to capture network requests
        await page.waitForTimeout(5000);
        
        // Inject the download button
        await page.evaluate(() => {
            const controlButtons = document.querySelector("#main > app-player > ion-content > audio-player > audio-player-unrestored > div > div.controls-container.ng-star-inserted > div.control-buttons-container");
            if (controlButtons && !document.querySelector('.offline-download-btn')) {
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'offline-download-btn';
                downloadBtn.innerText = 'Download for Offline';
                downloadBtn.style.cssText = 'background: #4CAF50; color: white; border: none; padding: 10px; margin: 10px; cursor: pointer; border-radius: 5px;';
                
                downloadBtn.onclick = function() {
                    // Trigger the download from our server
                    fetch('/process-url', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ url: window.location.href })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.downloadLink) {
                            const a = document.createElement('a');
                            a.href = data.downloadLink;
                            a.download = 'audio.opus';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            
                            // Cache the page for offline access
                            if ('caches' in window) {
                                caches.open('offline-cache').then(cache => {
                                    cache.add(window.location.href);
                                });
                            }
                            
                            alert('Download started! The audio file will be saved for offline access.');
                        } else {
                            alert('Failed to find audio file.');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error downloading file.');
                    });
                };
                
                controlButtons.appendChild(downloadBtn);
            }
        });
        
    } catch (error) {
        console.error('Error during navigation:', error.message);
    } finally {
        await browser.close();
    }
    
    return opusUrl;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
