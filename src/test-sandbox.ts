import * as fs from 'fs';
import * as path from 'path';

// Try to access a sensitive file outside the sandbox
const target = path.join(process.cwd(), '../sensitive.txt');

try {
    console.log('Attempting to read:', target);
    fs.readFileSync(target, 'utf-8');
    console.log('FAIL: Read succeeded (Sanbdox escape!)');
    process.exit(1);
} catch (e: any) {
    if (e.message.includes('Access Denied')) {
        console.log('SUCCESS: Access Denied caught by Sandbox.');
        process.exit(0);
    } else {
        console.log('ERROR: Unexpected error:', e.message);
        process.exit(1);
    }
}
