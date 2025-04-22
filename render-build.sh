#!/usr/bin/env bash
set -o errexit

npm install

export PUPPETEER_CACHE_DIR=$(pwd)/.cache/puppeteer

echo "Puppeteer cache directory: $PUPPETEER_CACHE_DIR"

npx puppeteer browsers install chrome
