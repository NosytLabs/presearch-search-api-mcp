import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  try {
    console.log('Building Presearch MCP Server...');
    
    // Create dist directory
    const distDir = join(__dirname, 'dist');
    await fs.mkdir(distDir, { recursive: true });
    
    // Copy src directory contents
    const srcDir = join(__dirname, 'src');
    await copyDir(srcDir, distDir);
    
    // Copy config directory contents
    const configDir = join(__dirname, 'config');
    await copyDir(configDir, distDir);
    
    // Create index.js entry point
    const indexContent = `import('./server/server.js');`;
    await fs.writeFile(join(distDir, 'index.js'), indexContent);
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();