// download-chromium.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Puppeteer for Render deployment...');

try {
  // Install the Puppeteer CLI
  console.log('Installing Puppeteer CLI...');
  execSync('npm install -g puppeteer', { stdio: 'inherit' });
  
  // Use puppeteer CLI to install Chrome
  console.log('Installing Chrome browser...');
  try {
    execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
    console.log('Chrome browser installed successfully');
  } catch (error) {
    console.error('Error installing Chrome browser:', error.message);
    console.log('Continuing anyway...');
  }
  
  // Try to find the installed browser location
  console.log('Checking for Chrome installation...');
  try {
    const browserInfo = execSync('npx puppeteer browsers list', { encoding: 'utf8' });
    console.log('Browsers found:');
    console.log(browserInfo);
    
    // Parse the browserInfo to find Chrome path
    const lines = browserInfo.split('\n');
    let chromePath = null;
    
    for (const line of lines) {
      if (line.includes('chrome') && line.includes('/')) {
        // Extract path from the line
        const parts = line.split(' ');
        for (const part of parts) {
          if (part.startsWith('/')) {
            chromePath = part;
            break;
          }
        }
        if (chromePath) break;
      }
    }
    
    if (chromePath) {
      console.log('Found Chrome path:', chromePath);
      // Save the path
      fs.writeFileSync(
        path.join(__dirname, 'chromium-path.json'), 
        JSON.stringify({ executablePath: chromePath })
      );
      console.log('Chrome path saved to chromium-path.json');
    } else {
      console.log('Could not extract Chrome path from browser list');
    }
  } catch (error) {
    console.error('Error listing browsers:', error.message);
  }
  
  console.log('Puppeteer setup completed - will try to use default browser');
} catch (error) {
  console.error('Error setting up Puppeteer:', error);
  console.log('Will continue with default Puppeteer configuration');
}
