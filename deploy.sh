#!/bin/bash

# Exit on error
set -e

# Check for required files
if [ ! -f "backend/firebase-adminsdk.json" ]; then
    echo "Error: Firebase service account key not found in backend directory"
    exit 1
fi

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
if [ ! -d "build" ]; then
    echo "Error: Frontend build failed - build directory not found"
    exit 1
fi
cd ..

# Deploy backend
echo "Deploying backend..."
cd backend
# Copy Firebase service account key to a secure location
cp firebase-adminsdk.json /tmp/firebase-adminsdk.json
gcloud app deploy app.yaml --project verifiai --version=1 --quiet
cd ..

# Deploy frontend
echo "Deploying frontend..."
cd frontend
gcloud app deploy app.yaml --project verifiai --version=1 --quiet
cd ..

echo "Deployment complete!"
echo "Frontend will be available at: localhost:3002"
echo "Backend API will be available at: https://backend-dot-verifiai.uc.r.appspot.com"
echo "Firebase Storage will be available at: https://firebasestorage.googleapis.com/v0/b/verifiai.appspot.com" 