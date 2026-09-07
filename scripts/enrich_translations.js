/**
 * enrich_translations.js
 * Wrapper around enrich_translations.py to ensure backwards-compatibility.
 */
const { execSync } = require('child_process');
const path = require('path');

const pyScript = path.join(__dirname, 'enrich_translations.py');
console.log('Running enrich_translations.py...');
execSync(`python3 "${pyScript}"`, { stdio: 'inherit' });
