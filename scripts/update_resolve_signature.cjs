const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '../public/data/inheritance_map.json');
const resolvePath = path.join(__dirname, '../src/reference/resolve_signature.ts');

if (!fs.existsSync(mapPath)) {
  console.error('Map not found at:', mapPath);
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
const resolveContent = fs.readFileSync(resolvePath, 'utf-8');

const newMapStr = '  static readonly INHERITANCE_MAP: Record<string, string[]> = ' + 
  JSON.stringify(map, null, 2).split('\n').join('\n  ');

const regex = /static readonly INHERITANCE_MAP: Record<string, string\[\]> = \{[\s\S]+?\n\s+\}/;
const updatedContent = resolveContent.replace(regex, newMapStr);

fs.writeFileSync(resolvePath, updatedContent);
console.log('Successfully updated INHERITANCE_MAP in resolve_signature.ts');
