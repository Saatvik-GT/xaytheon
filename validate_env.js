/**
 * validate_env.js
 * 
 * Run: node validate_env.js
 * 
 * Verifies local setup requirements, files, and Node.js environment.
 */

const fs = require('fs');
const path = require('path');

console.log('\x1b[35m%s\x1b[0m', '=== Xaytheon Developer Environment Validator ===\n');

let errors = 0;
let warnings = 0;

// 1. Check Node.js Version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
if (majorVersion < 18) {
  console.log('\x1b[31m%s\x1b[0m', `❌ Node.js Version: ${nodeVersion} detected. Node.js 18+ is recommended.`);
  errors++;
} else {
  console.log('\x1b[32m%s\x1b[0m', `✅ Node.js Version: ${nodeVersion} is compatible.`);
}

// 2. Check essential project files
const requiredFiles = [
  'index.html',
  'style.css',
  'auth.js',
  'script.js',
  'navbar.html',
  'README.md'
];

console.log('\nChecking required core project files...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log('\x1b[32m%s\x1b[0m', `  ✅ Found ${file}`);
  } else {
    console.log('\x1b[31m%s\x1b[0m', `  ❌ Missing crucial file: ${file}`);
    errors++;
  }
});

// 3. Check for auth configuration keys
console.log('\nValidating Supabase authentication keys in auth.js...');
const authFilePath = path.join(__dirname, 'auth.js');
if (fs.existsSync(authFilePath)) {
  const content = fs.readFileSync(authFilePath, 'utf8');
  if (content.includes("SUPABASE_URL = ''") || content.includes('SUPABASE_KEY = \'\'') || content.includes('change_me')) {
    console.log('\x1b[33m%s\x1b[0m', '  ⚠️ Supabase keys appear to be empty or unconfigured.');
    warnings++;
  } else {
    console.log('\x1b[32m%s\x1b[0m', '  ✅ Supabase configuration keys found in auth.js.');
  }
}

// 4. Summarize results
console.log('\n=============================================');
if (errors > 0) {
  console.log('\x1b[31m%s\x1b[0m', `Environment validation FAILED with ${errors} error(s) and ${warnings} warning(s).`);
  console.log('Please resolve the missing files or environment issues before running the project.');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\x1b[33m%s\x1b[0m', `Environment validation PASSED with ${warnings} warning(s).`);
  console.log('You are ready to run the app, but check the warnings above.');
  process.exit(0);
} else {
  console.log('\x1b[32m%s\x1b[0m', 'Environment validation PASSED with 0 errors/warnings! You are fully set up. 🚀');
  process.exit(0);
}
