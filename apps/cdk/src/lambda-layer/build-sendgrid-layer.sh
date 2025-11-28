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
if [ -f "sendgrid-layer.zip" ]; then
    echo "Removing old sendgrid-layer.zip..."
    rm -f sendgrid-layer.zip
fi

# Create the layer directory structure
echo "Creating layer directory structure..."
mkdir -p python/lib/python3.11/site-packages

# Install sendgrid into the layer directory
echo "Installing sendgrid and dependencies..."
pip install -r sendgrid-layer/requirements.txt -t python/lib/python3.11/site-packages/

# Create the layer zip file
echo "Creating sendgrid-layer.zip..."
zip -r sendgrid-layer.zip python/

echo "SendGrid Lambda layer created: sendgrid-layer.zip"

# Cleanup is handled by trap

