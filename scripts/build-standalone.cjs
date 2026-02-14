const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('🚀 Starting Standalone Build...');

// 1. Clean dist
if (fs.existsSync(distDir)) {
    console.log('🧹 Cleaning dist folder...');
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// 2. Build TypeScript
console.log('🔨 Compiling TypeScript...');
try {
    execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
    console.error('❌ Build failed!');
    process.exit(1);
}

// 3. Copy Key Files
console.log('copying files...');
const filesToCopy = ['package.json', '.env.example']; 
filesToCopy.forEach(file => {
    const src = path.join(rootDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`   ✅ Copied ${file}`);
    } else {
        console.warn(`   ⚠️  Missing ${file} (Skipping)`);
    }
});

// 4. Install Production Dependencies
console.log('📦 Installing production dependencies in dist...');
try {
    // Only install dependencies, ignore devDependencies
    execSync('npm install --production --no-bin-links', { cwd: distDir, stdio: 'inherit' });
} catch (e) {
    console.error('❌ Failed to install dependencies!');
    process.exit(1);
}

console.log('\n✅ Build Complete! The "dist" folder is now fully portable.');
console.log('👉 You can move "dist" anywhere and run: node lark_server.js');
