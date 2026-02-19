
const fs = require('fs');
const html = fs.readFileSync('auth_help2.html', 'utf8');
const scriptMatch = html.match(/function generateUrl\(\)\s*\{([\s\S]*?)\}/);
if (scriptMatch) {
    fs.writeFileSync('extracted_script.js', scriptMatch[0]);
}
const inputs = html.match(/<input[^>]*>/gi);
if (inputs) {
    fs.writeFileSync('extracted_inputs.txt', inputs.join('\n'));
}
