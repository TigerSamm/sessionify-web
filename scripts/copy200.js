import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const distDir = process.cwd() + '/dist';
const indexPath = join(distDir, 'index.html');
const fallbackPath = join(distDir, '200.html');

try {
  if (!existsSync(indexPath)) {
    console.error('copy200: index.html not found at', indexPath);
    process.exit(1);
  }
  copyFileSync(indexPath, fallbackPath);
  console.log('copy200: copied', indexPath, '->', fallbackPath);
} catch (err) {
  console.error('copy200: failed to copy index.html to 200.html', err);
  process.exit(1);
}
