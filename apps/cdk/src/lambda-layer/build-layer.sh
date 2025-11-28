#!/bin/bash

# Exit on error
set -e

# Cleanup function
cleanup() {
    if [ -d "python" ]; then
        echo "Cleaning up temporary python directory..."
        rm -rf python
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Remove old zip file if it exists
if [ -f "requests-layer.zip" ]; then
    echo "Removing old requests-layer.zip..."
    rm -f requests-layer.zip
fi

# Create the layer directory structure
echo "Creating layer directory structure..."
mkdir -p python/lib/python3.11/site-packages

# Install requests into the layer directory
echo "Installing requests and dependencies..."
pip install -r requests-layer/requirements.txt -t python/lib/python3.11/site-packages/

# Create the layer zip file
echo "Creating requests-layer.zip..."
zip -r requests-layer.zip python/

echo "Lambda layer created: requests-layer.zip"

# Cleanup is handled by trap
