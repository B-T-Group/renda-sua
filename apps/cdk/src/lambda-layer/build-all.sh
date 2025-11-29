#!/bin/bash

# Build all Lambda layers
# This script builds requests, sendgrid, and core-packages layers

set -e

echo "Building all Lambda layers..."

# Build requests layer
echo ""
echo "=== Building requests layer ==="
bash build-layer.sh

echo ""
echo "=== Building sendgrid layer ==="
bash build-sendgrid-layer.sh

echo ""
echo "=== Building core-packages layer ==="
bash build-core-packages-layer.sh

echo ""
echo "All Lambda layers built successfully!"
echo "- requests-layer.zip"
echo "- sendgrid-layer.zip"
echo "- core-packages-layer.zip"

