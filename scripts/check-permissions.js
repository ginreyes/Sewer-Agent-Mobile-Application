#!/usr/bin/env node
/**
 * Ensures the app declares required permissions in AndroidManifest.xml.
 * Run: npm run check:permissions
 * Exit: 0 if all required permissions are present, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

// Permissions the app needs (declare here so one place defines "what this app needs")
const REQUIRED_ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.CAMERA',
];

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('AndroidManifest.xml not found at:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const missing = REQUIRED_ANDROID_PERMISSIONS.filter(
    (perm) => !manifest.includes(`android:name="${perm}"`)
  );

  if (missing.length === 0) {
    console.log('Required permissions are declared in AndroidManifest.xml:');
    REQUIRED_ANDROID_PERMISSIONS.forEach((p) => console.log('  -', p));
    process.exit(0);
  }

  console.error('Missing required permission(s) in AndroidManifest.xml:');
  missing.forEach((p) => console.error('  -', p));
  console.error('\nAdd them inside <manifest> (e.g. before <application>):');
  console.error('  <uses-permission android:name="android.permission.INTERNET" />');
  console.error('  <uses-permission android:name="android.permission.CAMERA" />');
  process.exit(1);
}

main();
