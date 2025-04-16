#!/bin/bash

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r ../requirements.txt

# Start the server
node server.js 