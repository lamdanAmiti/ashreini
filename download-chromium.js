// download-chromium.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Puppeteer for Render deployment...');

// Set environment variables to ensure Puppeteer downloads Chromium
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';

try {
  // Install Puppeteer with Chromium
  console.log('Downloading Chromium...');
  execSync('npm uninstall puppeteer && npm install puppeteer@22.8.2', { stdio: 'inherit' });
  console.log('Puppeteer reinstalled with Chromium');
  
  // Create a file to store the Chromium path
  const puppeteer = require('puppeteer');
  const browserFetcher = puppeteer.createBrowserFetcher();
  const revisionInfo = browserFetcher.revisionInfo();
  
  console.log('Chromium installed at:', revisionInfo.executablePath);
  console.log('Revision information:', JSON.stringify(revisionInfo, null, 2));
  
  // Save the executable path to a file for the server to read
  fs.writeFileSync(
    path.join(__dirname, 'chromium-path.json'), 
    JSON.stringify({ executablePath: revisionInfo.executablePath })
  );
  
  console.log('Chromium path saved to chromium-path.json');
  console.log('Puppeteer setup completed successfully!');
} catch (error) {
  console.error('Error setting up Puppeteer:', error);
  process.exit(1);
}
