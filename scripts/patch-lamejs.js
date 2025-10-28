/**
 * Patch lamejs to fix multiple missing import bugs
 * This runs after npm install to fix broken imports in Lame.js and BitStream.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lamejsDir = join(__dirname, '../node_modules/lamejs/src/js');

console.log('🔧 Patching lamejs to fix missing imports...');

try {
  let patchCount = 0;
  
  // PATCH 1: Lame.js - Missing MPEGMode import
  const lamePath = join(lamejsDir, 'Lame.js');
  let lameContent = readFileSync(lamePath, 'utf8');
  
  if (!lameContent.includes("var MPEGMode = require('./MPEGMode.js');")) {
    lameContent = lameContent.replace(
      "var LameInternalFlags = require('./LameInternalFlags.js');",
      `var LameInternalFlags = require('./LameInternalFlags.js');
var MPEGMode = require('./MPEGMode.js');  // PATCH: Missing import`
    );
    writeFileSync(lamePath, lameContent, 'utf8');
    console.log('  ✅ Patched Lame.js - Added MPEGMode import');
    patchCount++;
  }
  
  // PATCH 2: BitStream.js - Missing Lame import
  const bitStreamPath = join(lamejsDir, 'BitStream.js');
  let bitStreamContent = readFileSync(bitStreamPath, 'utf8');
  
  if (!bitStreamContent.includes("var Lame = require('./Lame.js');")) {
    bitStreamContent = bitStreamContent.replace(
      "var LameInternalFlags = require('./LameInternalFlags.js');",
      `var Lame = require('./Lame.js');  // PATCH: Missing import
var LameInternalFlags = require('./LameInternalFlags.js');`
    );
    writeFileSync(bitStreamPath, bitStreamContent, 'utf8');
    console.log('  ✅ Patched BitStream.js - Added Lame import');
    patchCount++;
  }
  
  if (patchCount > 0) {
    console.log(`✅ lamejs patched successfully! (${patchCount} files fixed)`);
  } else {
    console.log('✅ lamejs already patched!');
  }
  
} catch (error) {
  console.error('❌ Failed to patch lamejs:', error);
  console.error('   MP3 encoding may not work');
  // Don't fail the build
  process.exit(0);
}


