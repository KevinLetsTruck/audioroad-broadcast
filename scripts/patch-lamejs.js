/**
 * Patch lamejs to fix MPEGMode import bug
 * This runs after npm install to fix the missing import in Lame.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lamejsPath = join(__dirname, '../node_modules/lamejs/src/js/Lame.js');

console.log('🔧 Patching lamejs to fix MPEGMode import bug...');

try {
  let content = readFileSync(lamejsPath, 'utf8');
  
  // Check if already patched
  if (content.includes("var MPEGMode = require('./MPEGMode.js');")) {
    console.log('✅ lamejs already patched!');
    process.exit(0);
  }
  
  // Add the missing import after LameInternalFlags
  const searchString = "var LameInternalFlags = require('./LameInternalFlags.js');";
  const replacement = `var LameInternalFlags = require('./LameInternalFlags.js');
var MPEGMode = require('./MPEGMode.js');  // PATCH: Missing import causing MPEGMode is not defined`;
  
  content = content.replace(searchString, replacement);
  
  writeFileSync(lamejsPath, content, 'utf8');
  
  console.log('✅ lamejs patched successfully!');
  console.log('   Added: var MPEGMode = require(\'./MPEGMode.js\');');
  console.log('   This fixes the MPEGMode is not defined error');
  
} catch (error) {
  console.error('❌ Failed to patch lamejs:', error);
  console.error('   MP3 encoding may not work');
  // Don't fail the build
  process.exit(0);
}


