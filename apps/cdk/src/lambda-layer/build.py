#!/usr/bin/env python3
import os
import subprocess
import zipfile
import shutil

def build_layer():
    """Build the Lambda layer with requests library"""
    
    # Create directories
    layer_dir = "python/lib/python3.9/site-packages"
    os.makedirs(layer_dir, exist_ok=True)
    
    # Install requests
    subprocess.run([
        "pip", "install", 
        "-r", "requests-layer/requirements.txt",
        "-t", layer_dir
    ], check=True)
    
    # Create zip file
    with zipfile.ZipFile("requests-layer.zip", "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("python"):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, ".")
                zipf.write(file_path, arcname)
    
    # Clean up
    shutil.rmtree("python")
    
    print("Lambda layer created: requests-layer.zip")

if __name__ == "__main__":
    build_layer()
