#!/bin/bash

# Build the core-packages Lambda layer
set -e

cleanup() {
    if [ -d "python" ]; then
        echo "Cleaning up temporary python directory..."
        rm -rf python
    fi
}

trap cleanup EXIT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building core-packages Lambda layer..."

# Remove old zip file if it exists
if [ -f "core-packages-layer.zip" ]; then
    echo "Removing old core-packages-layer.zip..."
    rm -f core-packages-layer.zip
fi

echo "Creating layer directory structure..."
mkdir -p python/lib/python3.11/site-packages

echo "Copying core-packages source modules..."
cp -R "${ROOT_DIR}/../core-packages"/. python/

echo "Installing core-packages dependencies (requests, sendgrid, pydantic)..."
pip install -r "${ROOT_DIR}/../core-packages/requirements.txt" \
    -t python/lib/python3.11/site-packages/

echo "Creating core-packages-layer.zip..."
zip -r core-packages-layer.zip python/

echo "Core-packages Lambda layer created: core-packages-layer.zip"


