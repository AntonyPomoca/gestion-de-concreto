import fs from 'fs';
import path from 'path';

const imagePath = path.resolve(process.cwd(), 'src/assets/olla.png');
const base64Image = fs.readFileSync(imagePath).toString('base64');
console.log('BASE64_START');
console.log(`data:image/png;base64,${base64Image}`);
console.log('BASE64_END');
