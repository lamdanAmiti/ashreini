// download-chromium.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Puppeteer for Render deployment...');

try {
  // Make sure puppeteer downloads Chromium
  console.log('Making sure Puppeteer is installed with Chromium...');
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
  
  console.log('Installing Puppeteer with Chromium...');
  execSync('npm install puppeteer@22.8.2', { stdio: 'inherit' });
  
  // Get installation info
  console.log('Getting Puppeteer installation info...');
  const puppeteer = require('puppeteer');
  
  // Create a simple test to confirm Puppeteer works
  async function testPuppeteer() {
    console.log('Testing Puppeteer installation...');
    try {
      // Launch browser to test if it works
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // Get the executable path from the browser
      const browserInfo = await browser.version();
      const executablePath = browser.process().spawnfile;
      
      console.log('Browser version:', browserInfo);
      console.log('Executable path:', executablePath);
      
      // Store the executable path
      fs.writeFileSync(
        path.join(__dirname, 'chromium-path.json'), 
        JSON.stringify({ 
          executablePath: executablePath,
          version: browserInfo
        })
      );
      
      await browser.close();
      console.log('Browser test successful!');
    } catch (error) {
      console.error('Error testing Puppeteer:', error);
      // Even if test fails, we'll continue
    }
  }
  
  // Run the test
  testPuppeteer().then(() => {
    console.log('Puppeteer setup completed!');
  }).catch(err => {
    console.error('Error during Puppeteer test:', err);
    // Continue anyway
    console.log('Will try to use default Puppeteer installation despite test error.');
  });
  
} catch (error) {
  console.error('Error setting up Puppeteer:', error);
  // Continue with the build even if this script fails
  console.log('Continuing with default Puppeteer installation...');
}
