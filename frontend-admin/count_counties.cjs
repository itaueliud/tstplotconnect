const fs = require('fs');

function extractCount(filePath, exportName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf('export const ' + exportName);
    if (startIdx === -1) return 0;
    const arrayStart = content.indexOf('[', startIdx);
    const arrayEnd = content.indexOf(']', arrayStart);
    if (arrayStart === -1 || arrayEnd === -1) return 0;
    const arrayContent = content.substring(arrayStart + 1, arrayEnd);
    return arrayContent.split(',').map(s => s.trim()).filter(s => s.length > 0).length;
}

console.log('Kenya:', extractCount('src/main/kenya/counties.ts', 'kenyaCounties'));
console.log('Uganda:', extractCount('src/main/uganda/counties.ts', 'ugandaCounties'));
console.log('Tanzania:', extractCount('src/main/tanzania/counties.ts', 'tanzaniaCounties'));
