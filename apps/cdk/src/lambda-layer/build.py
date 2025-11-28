#!/usr/bin/env python3
import os
import subprocess
import zipfile
import shutil
import sys

def build_layer():
    """Build the Lambda layer with requests library"""
    
    try:
        # Remove old zip file if it exists
        if os.path.exists("requests-layer.zip"):
            print("Removing old requests-layer.zip...")
            os.remove("requests-layer.zip")
        
        # Create directories
        layer_dir = "python/lib/python3.11/site-packages"
        print("Creating layer directory structure...")
        os.makedirs(layer_dir, exist_ok=True)
        
        # Install requests
        print("Installing requests and dependencies...")
        subprocess.run([
            "pip", "install", 
            "-r", "requests-layer/requirements.txt",
            "-t", layer_dir
        ], check=True)
        
        # Create zip file
        print("Creating requests-layer.zip...")
        with zipfile.ZipFile("requests-layer.zip", "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk("python"):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, ".")
                    zipf.write(file_path, arcname)
        
        print("Lambda layer created: requests-layer.zip")
        
    except Exception as e:
        print(f"Error building layer: {e}", file=sys.stderr)
        sys.exit(1)
        
    finally:
        # Clean up temporary directory
        if os.path.exists("python"):
            print("Cleaning up temporary python directory...")
            shutil.rmtree("python")

if __name__ == "__main__":
    build_layer()
