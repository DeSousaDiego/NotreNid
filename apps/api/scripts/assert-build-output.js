// Garde-fou post-build (Release 0B) : un `nest build` peut sortir en code 0 sans avoir émis
// dist/main.js (cache incrémental périmé). On échoue explicitement plutôt que de livrer
// une image Docker sans point d'entrée.
const { existsSync, statSync } = require('node:fs');
const path = require('node:path');

const entry = path.resolve(__dirname, '..', 'dist', 'main.js');
if (!existsSync(entry) || statSync(entry).size === 0) {
  console.error(`Build invalide : ${path.relative(process.cwd(), entry)} est absent ou vide.`);
  process.exit(1);
}
