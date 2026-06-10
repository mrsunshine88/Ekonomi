const sharp = require('sharp');
const fs = require('fs');

async function generateIcons() {
    const input = 'public/new_icon.png';
    
    if (!fs.existsSync(input)) {
        console.error('new_icon.png does not exist!');
        return;
    }

    console.log('Processing 192x192...');
    await sharp(input)
        .resize(192, 192, { fit: 'cover' })
        .toFile('public/icon-192x192.png');

    console.log('Processing 512x512...');
    await sharp(input)
        .resize(512, 512, { fit: 'cover' })
        .toFile('public/icon-512x512.png');

    console.log('Processing favicon (64x64)...');
    await sharp(input)
        .resize(64, 64, { fit: 'cover' })
        .toFile('public/favicon.png');

    console.log('All icons generated successfully!');
}

generateIcons().catch(err => console.error(err));
