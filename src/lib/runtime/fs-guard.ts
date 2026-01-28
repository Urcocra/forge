import * as fs from 'fs';
import * as path from 'path';

// --- Essential Sandbox: FS Guard ---
// Monkey-patches fs module to restrict access to CWD.

const CWD = process.cwd();

function isAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return resolved.startsWith(CWD);
}

function check(args: any[]) {
    // First arg is usually path
    if (args.length > 0 && typeof args[0] === 'string') {
        if (!isAllowed(args[0])) {
            throw new Error(`[Sandbox] Access Denied: ${args[0]}`);
        }
    }
}

// Save originals
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;
const originalReadFile = fs.readFile;
const originalWriteFile = fs.writeFile;
const originalReaddir = fs.readdir;
const originalReaddirSync = fs.readdirSync;
const originalMkdir = fs.mkdir;
const originalMkdirSync = fs.mkdirSync;

// Patch Sync methods
// @ts-ignore
fs.readFileSync = function (...args: any[]) {
    check(args);
    return originalReadFileSync.apply(this, args as any);
};

// @ts-ignore
fs.writeFileSync = function (...args: any[]) {
    check(args);
    return originalWriteFileSync.apply(this, args as any);
};

// @ts-ignore
fs.readdirSync = function (...args: any[]) {
    check(args);
    return originalReaddirSync.apply(this, args as any);
};

// @ts-ignore
fs.mkdirSync = function (...args: any[]) {
    check(args);
    return originalMkdirSync.apply(this, args as any);
};

// Patch Async methods (basic)
// @ts-ignore
fs.readFile = function (...args: any[]) {
    check(args);
    return originalReadFile.apply(this, args as any);
};

// @ts-ignore
fs.writeFile = function (...args: any[]) {
    check(args);
    return originalWriteFile.apply(this, args as any);
};

// @ts-ignore
fs.readdir = function (...args: any[]) {
    check(args);
    return originalReaddir.apply(this, args as any);
};

// @ts-ignore
fs.mkdir = function (...args: any[]) {
    check(args);
    return originalMkdir.apply(this, args as any);
};

console.log('[Sandbox] FS Guard Active. Root:', CWD);
