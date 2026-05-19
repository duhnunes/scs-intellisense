const { renameSync, readdirSync, mkdirSync } = require("fs");
const { join } = require("path");

const distPath = join(__dirname, "../release");

// Find the .vsix file in the current folder
const vsixFile = readdirSync(".").find(f => f.endsWith(".vsix"));

if (!vsixFile) {
  console.error("❌ No .vsix file found to move.");
  process.exit(1);
}

// Ensure dist folder exists
mkdirSync(distPath, { recursive: true });

// Move the file
renameSync(vsixFile, join(distPath, vsixFile));

console.log(`✅ Moved ${vsixFile} to ${distPath}`);
