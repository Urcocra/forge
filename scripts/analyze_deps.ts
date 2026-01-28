
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve('src');

function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            if (filePath.endsWith('.ts')) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

function getImports(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Regex for: import ... from '...'; or import '...'; or export ... from '...';
    // Matches: from '...' or import '...'
    const regex = /(?:from|import)\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        let importPath = match[1];
        if (importPath.startsWith('.')) {
            // Resolve relative path
            let resolved = path.resolve(path.dirname(filePath), importPath);
            // Try adding .ts if not present (and not a directory - simplified assumption)
            if (fs.existsSync(resolved + '.ts')) {
                resolved += '.ts';
            } else if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                if (fs.existsSync(path.join(resolved, 'index.ts'))) {
                    resolved = path.join(resolved, 'index.ts');
                }
            } else {
                // Try looking for directory/index.ts even if directory is not explicitly checked above?
                // The above covers import './lib/task' -> .../lib/task.ts
            }
            imports.push(resolved);
        }
    }
    return imports;
}

function analyze() {
    const allFiles = getAllFiles(SRC_DIR);
    const graph: Record<string, string[]> = {};
    const refCounts: Record<string, number> = {};

    allFiles.forEach(f => {
        graph[f] = [];
        if (!refCounts[f]) refCounts[f] = 0;
    });

    allFiles.forEach(f => {
        const imports = getImports(f);
        imports.forEach(imp => {
            // Use canonical path matching
            const target = allFiles.find(af => af.toLowerCase() === imp.toLowerCase());
            if (target) {
                graph[f].push(target);
                refCounts[target] = (refCounts[target] || 0) + 1;
            }
        });
    });

    // Known entry points
    const entryPoints = [path.join(SRC_DIR, 'index.ts'), path.join(SRC_DIR, '..', 'test', 'mock.ts')]; // mock.ts likely in src/test/mock.ts if files listed showed that

    // Check src/test/mock.ts specifically
    // In previous list_dir: test/mock.ts was shown
    // Let's verify paths.
    // list_dir output:
    // "index.ts"
    // "lib/..."
    // "test/..."
    // So src/test/mock.ts is correct.

    // Filter for files in src/lib
    const libFiles = allFiles.filter(f => f.includes('src\\lib') || f.includes('src/lib'));

    // Write output to file
    let output = '';
    output += '--- Dependency Graph (src/lib) ---\n';
    libFiles.forEach(f => {
        const relative = path.relative(SRC_DIR, f);
        const deps = graph[f].map(d => path.relative(SRC_DIR, d));
        output += `${relative} imports: [${deps.join(', ')}]\n`;
    });

    output += '\n--- Unused Files (0 referrers, excluding entry points) ---\n';
    libFiles.forEach(f => {
        // Fix for casing issues on Windows
        const count = refCounts[f] || 0;
        if (count === 0) {
            output += path.relative(SRC_DIR, f) + '\n';
        }
    });

    fs.writeFileSync('analysis_results_utf8.txt', output, 'utf-8');
    console.log('Analysis written to analysis_results_utf8.txt');


    // Also check for "transitive unused" if needed (circles of unused files)
    // But 0 referrers is the first step.
}

analyze();
