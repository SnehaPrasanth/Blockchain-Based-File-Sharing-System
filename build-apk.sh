#!/bin/bash

echo "Starting APK build process..."

# Install EAS CLI if not already installed
if ! command -v eas &> /dev/null
then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Login to Expo (this will prompt for login)
echo "Logging in to Expo..."
eas login

# Configure the build
echo "Building APK..."
eas build -p android --profile preview

echo "APK build process initiated. You can download the APK from the Expo dashboard once the build is complete."