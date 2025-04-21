#!/bin/bash

echo "Setting up Chrome for Puppeteer..."

# Update package lists
apt-get update

# Install Chrome dependencies
apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates

# Install Chrome
wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt-get install -y /tmp/chrome.deb
rm /tmp/chrome.deb

# Verify Chrome installation
echo "Chrome version:"
google-chrome --version

# Create symbolic link if needed
if [ ! -e /usr/bin/chromium-browser ]; then
    ln -s /usr/bin/google-chrome /usr/bin/chromium-browser
    echo "Created symbolic link from google-chrome to chromium-browser"
fi

echo "Chrome setup completed!"
