# Assets Directory

This directory contains application icons and resources for Nubia.

## Required Icons

For production builds, you need to provide the following icon files:

### Windows
- `icon.ico` - Windows icon file (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)

### macOS  
- `icon.icns` - macOS icon file (multiple resolutions: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024)

### Linux
- `icon.png` - PNG icon file (512x512 recommended)

## Icon Design Guidelines

The Nubia app icon should:
- Use the brand colors: Primary #667eea, Secondary #764ba2
- Include the 🤖 robot emoji or a stylized AI/automation symbol
- Work well at small sizes (16x16) and large sizes (1024x1024)
- Have a modern, professional appearance
- Be recognizable and unique

## Generating Icons

You can use online tools or design software to create these icons:

1. Create a master 1024x1024 PNG file
2. Use tools like `electron-icon-builder` to generate all required formats:
   ```bash
   npm install -g electron-icon-builder
   electron-icon-builder --input=./icon-master.png --output=./assets/
   ```

## Current Status

🚧 **Placeholder icons needed** - The current build uses placeholder icons.
For production deployment, replace these with professional app icons.