// clean_ejs_trailer.js
// Usage: node clean_ejs_trailer.js <path-to-ejs-file>
// Ensures the file ends with exactly </script> and nothing after it (no whitespace, no newline).

const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('Usage: node clean_ejs_trailer.js <path-to-ejs-file>');
  process.exit(1);
}

let content = fs.readFileSync(path, 'utf8');

// Find the last occurrence of </script>
const lastScriptTag = content.lastIndexOf('</script>');
if (lastScriptTag === -1) {
  console.error('No </script> tag found in file.');
  process.exit(1);
}

// Remove anything after the last </script>
const cleaned = content.slice(0, lastScriptTag + 9);

fs.writeFileSync(path, cleaned, 'utf8');
console.log(`Cleaned file: ${path}`);
