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

echo "Installing core-packages as a package..."
# Install the package to site-packages
cd "${ROOT_DIR}/../core-packages"
pip install . -t "${ROOT_DIR}/python/lib/python3.11/site-packages/" --no-deps --upgrade

echo "Installing core-packages dependencies (requests, sendgrid, pydantic)..."
pip install -r "${ROOT_DIR}/../core-packages/requirements.txt" \
    -t "${ROOT_DIR}/python/lib/python3.11/site-packages/" \
    --upgrade

# Return to lambda-layer directory for zip creation
cd "${ROOT_DIR}"

echo "Creating core-packages-layer.zip..."
if [ ! -d "python" ]; then
    echo "ERROR: python directory does not exist!"
    exit 1
fi
zip -r core-packages-layer.zip python/

echo "Core-packages Lambda layer created: core-packages-layer.zip"

# Cleanup after creating zip
cleanup


