#!/bin/bash

# Build all Lambda layers (requests + core-packages)

set -e

echo "Building all Lambda layers..."

echo ""
echo "=== Building requests layer ==="
bash build-layer.sh

echo ""
echo "=== Building core-packages layer ==="
bash build-core-packages-layer.sh

echo ""
echo "All Lambda layers built successfully!"
echo "- requests-layer.zip"
echo "- core-packages-layer.zip"
