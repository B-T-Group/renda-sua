#!/bin/bash

# Build script for backend that ensures proper exit
set -e

echo "🚀 Starting backend build..."

# Set environment variables
export NODE_ENV=production

# Build the backend
echo "📦 Building backend with NX..."
npx nx build backend --configuration=development

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Backend build completed successfully!"
    exit 0
else
    echo "❌ Backend build failed!"
    exit 1
fi
