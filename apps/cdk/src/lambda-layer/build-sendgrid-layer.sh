#!/bin/bash

# Create the layer directory structure
mkdir -p python/lib/python3.9/site-packages

# Install sendgrid into the layer directory
pip install -r sendgrid-layer/requirements.txt -t python/lib/python3.9/site-packages/

# Create the layer zip file
zip -r sendgrid-layer.zip python/

echo "SendGrid Lambda layer created: sendgrid-layer.zip"

