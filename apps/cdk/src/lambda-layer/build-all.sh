#!/bin/bash

# Build all Lambda layers
# This script builds both requests and sendgrid layers

set -e

echo "Building all Lambda layers..."

# Build requests layer
echo ""
echo "=== Building requests layer ==="
bash build-layer.sh

# Build sendgrid layer
echo ""
echo "=== Building sendgrid layer ==="
bash build-sendgrid-layer.sh

echo ""
echo "All Lambda layers built successfully!"
echo "- requests-layer.zip"
echo "- sendgrid-layer.zip"

