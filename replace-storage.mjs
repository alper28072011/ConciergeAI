import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (!dirPath.includes('node_modules')) {
      isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    }
  });
}

let modifiedFiles = [];
walkDir(path.join(__dirname, 'src'), (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;

    if (newContent.includes('localStorage.') && !filePath.includes('safeStorage.ts')) {
       newContent = newContent.replace(/localStorage\./g, 'window.safeStorage.');
    }

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      modifiedFiles.push(filePath);
    }
  }
});
console.log('Modified files:', modifiedFiles);
