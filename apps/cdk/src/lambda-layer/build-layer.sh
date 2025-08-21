#!/bin/bash

# Create the layer directory structure
mkdir -p python/lib/python3.9/site-packages

# Install requests into the layer directory
pip install -r requests-layer/requirements.txt -t python/lib/python3.9/site-packages/

# Create the layer zip file
zip -r requests-layer.zip python/

echo "Lambda layer created: requests-layer.zip"
