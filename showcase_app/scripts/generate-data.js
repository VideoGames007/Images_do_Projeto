import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGENS_DIR = path.resolve(__dirname, '../../_IMAGENS');
const PUBLIC_ASSETS_DIR = path.resolve(__dirname, '../public/assets');
const OUTPUT_DATA_DIR = path.resolve(__dirname, '../src/data');

if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
  fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DATA_DIR)) {
  fs.mkdirSync(OUTPUT_DATA_DIR, { recursive: true });
}

function normalizeName(name) {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function findCharacterSynopsisMap() {
  const map = {};
  const inspiradorDir = path.join(IMAGENS_DIR, '_INSPIRADOR', '_PERSONAGENS', '_EM_USO');
  if (!fs.existsSync(inspiradorDir)) return map;

  function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        const sobrePath = path.join(full, '__Sobre.txt');
        if (fs.existsSync(sobrePath)) {
          const parts = file.split('_');
          const charName = parts[parts.length - 1].toLowerCase();
          map[charName] = fs.readFileSync(sobrePath, 'utf8');
        }
        scan(full);
      }
    }
  }
  scan(inspiradorDir);
  return map;
}

const synopsesMap = findCharacterSynopsisMap();
let folderCounter = 0;

function walkDirectory(dirPath, relativeToRoot) {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) return null;

  const folderName = path.basename(dirPath);
  const node = {
    id: `node_${folderCounter++}`,
    name: folderName,
    type: 'folder',
    texts: [],
    images: [],
    children: [],
    coverImage: ""
  };

  const files = fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

  // Link character synopsis if this folder name matches a character in _INSPIRADOR
  const charNameMatch = folderName.toLowerCase();
  if (synopsesMap[charNameMatch]) {
    node.texts.push({
      title: '__Sobre.txt (Linkado do Inspirador)',
      content: synopsesMap[charNameMatch]
    });
  }

  // Pass 1: Files
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.txt') {
        const content = fs.readFileSync(fullPath, 'utf8');
        node.texts.push({
          title: file,
          content: content
        });
      } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg', '.bmp', '.tiff'].includes(ext)) {
        const targetDir = path.join(PUBLIC_ASSETS_DIR, relativeToRoot);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const safeFileName = normalizeName(file);
        const targetPath = path.join(targetDir, safeFileName);
        
        try {
          fs.copyFileSync(fullPath, targetPath);
          const assetUrl = `/assets/${relativeToRoot ? relativeToRoot + '/' : ''}${safeFileName}`;
          node.images.push({
            name: file,
            url: assetUrl
          });
        } catch(e) {
          console.error(`Error copying ${fullPath}`, e);
        }
      }
    }
  }

  if (node.images.length > 0) {
    node.coverImage = node.images[0].url;
  }

  // Pass 2: Dirs
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const newRelative = relativeToRoot ? `${relativeToRoot}/${normalizeName(file)}` : normalizeName(file);
      const childNode = walkDirectory(fullPath, newRelative);
      if (childNode) {
        node.children.push(childNode);
        if (!node.coverImage && childNode.coverImage) {
          node.coverImage = childNode.coverImage;
        }
      }
    }
  }

  return node;
}

console.log("Scanning directory tree...");
const rootNode = walkDirectory(IMAGENS_DIR, "");

// SPLIT JSON LOGIC
const indexData = {
  id: rootNode.id,
  name: rootNode.name,
  type: rootNode.type,
  texts: rootNode.texts,
  images: rootNode.images,
  coverImage: rootNode.coverImage,
  children: []
};

// Assuming structure: _IMAGENS -> Games and _INSPIRADOR
const fileExports = [];

for (const mainChild of rootNode.children) {
  if (mainChild.name === 'Games') {
    const gamesIndex = {
      id: mainChild.id,
      name: mainChild.name,
      type: mainChild.type,
      texts: mainChild.texts,
      images: mainChild.images,
      coverImage: mainChild.coverImage,
      children: []
    };
    
    for (const game of mainChild.children) {
      const safeGameName = normalizeName(game.name.toLowerCase());
      const fileName = `${safeGameName}.json`;
      fs.writeFileSync(path.join(OUTPUT_DATA_DIR, fileName), JSON.stringify(game, null, 2));
      fileExports.push(`export { default as ${safeGameName} } from './${fileName}';`);
      
      gamesIndex.children.push({
        id: game.id,
        name: game.name,
        type: "game_reference",
        file: safeGameName,
        coverImage: game.coverImage,
        childrenCount: game.children.length,
        imagesCount: game.images.length
      });
    }
    indexData.children.push(gamesIndex);
  } else {
    // For _INSPIRADOR or others
    const safeName = normalizeName(mainChild.name.toLowerCase());
    const fileName = `${safeName}.json`;
    fs.writeFileSync(path.join(OUTPUT_DATA_DIR, fileName), JSON.stringify(mainChild, null, 2));
    fileExports.push(`export { default as ${safeName} } from './${fileName}';`);
    
    indexData.children.push({
      id: mainChild.id,
      name: mainChild.name,
      type: "folder_reference",
      file: safeName,
      coverImage: mainChild.coverImage,
      childrenCount: mainChild.children.length,
      imagesCount: mainChild.images.length
    });
  }
}

// Write the main index file
fs.writeFileSync(path.join(OUTPUT_DATA_DIR, 'indexData.json'), JSON.stringify(indexData, null, 2));
fileExports.push(`export { default as rootIndex } from './indexData.json';`);

// Write an index.js to export all JSONs easily
fs.writeFileSync(path.join(OUTPUT_DATA_DIR, 'index.js'), fileExports.join('\n'));

console.log(`Data generation complete. JSONs split into src/data/`);
