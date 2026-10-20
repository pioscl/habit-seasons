import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relativePath = prefix + entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFiles(join(directory, entry.name), relativePath + '/'));
    } else if (entry.isFile() && relativePath !== 'sw.js') {
      files.push(relativePath);
    }
  }
  return files.sort();
}

export async function buildServiceWorker() {
  const template = await readFile(new URL('../pwa/sw.js', import.meta.url), 'utf8');
  const files = await listFiles(outputDirectory);
  if (!files.includes('index.html')) {
    throw new Error('Build the app with Vite before generating the service worker.');
  }

  // Include public assets and the worker template, so every offline change gets
  // a new cache even when it does not change the bundled JavaScript filename.
  const hash = createHash('sha256').update(template);
  for (const file of files) {
    hash.update(file).update('\0').update(await readFile(join(outputDirectory, file)));
  }
  const version = 'build-' + hash.digest('hex').slice(0, 16);
  const assets = ['./', ...files.map(file => './' + file)];
  const worker = template
    .replace('__BUILD_VERSION__', version)
    .replace('__PRECACHE_ASSETS__', JSON.stringify(assets));

  await writeFile(join(outputDirectory, 'sw.js'), worker);
  return {version, assetCount: assets.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {version, assetCount} = await buildServiceWorker();
  console.log(`Generated offline cache ${version} (${assetCount} assets).`);
}
