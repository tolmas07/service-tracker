import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Читаем текущую версию из package.json
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`Бамп версии: ${pkg.version} → ${newVersion}`);

// 1. Обновляем package.json
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Обновляем src/lib/constants.ts
const constantsPath = join(root, 'src', 'lib', 'constants.ts');
writeFileSync(constantsPath, `export const APP_VERSION = '${newVersion}';\n`);

// 3. Обновляем android/app/build.gradle
const gradlePath = join(root, 'android', 'app', 'build.gradle');
let gradle = readFileSync(gradlePath, 'utf-8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${major * 10000 + minor * 100 + patch + 1}`);
gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${newVersion}"`);
writeFileSync(gradlePath, gradle);

// 4. Обновляем public/version.json
const versionPath = join(root, 'public', 'version.json');
const versionData = JSON.parse(readFileSync(versionPath, 'utf-8'));
versionData.version = newVersion;
versionData.minVersion = `${major}.${minor}.0`;
versionData.changelog = `Версия ${newVersion} — улучшения и исправления`;
writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');

console.log(`Версия обновлена до ${newVersion} в:`);
console.log(`  - package.json`);
console.log(`  - src/lib/constants.ts`);
console.log(`  - android/app/build.gradle`);
console.log(`  - public/version.json`);

// Выводим версию для GitHub Actions
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`, { flag: 'a' });
}
