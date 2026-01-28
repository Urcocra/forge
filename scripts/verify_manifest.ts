
import { runTask } from './src/lib/exec';
import { TaskSpec, ModelRequest } from './src/lib/types';

const mockTask: TaskSpec = {
    id: 'test-manifest',
    size: 'M', // triggers runtime
    questionPoolSize: 1,
    question: {
        qid: 'test',
        description: 'test',
        expectedArtifacts: ['index.html'],
        treeRules: { requiredFiles: ['index.html'] }
    },
    runtime: {
        type: 'node',
        entry: 'index.js'
    }
};

const mockModel = async (req: ModelRequest) => {
    if (req.phase === 'tree') {
        return {
            tree: { files: [{ path: 'index.html', type: 'file' }, { path: 'index.js', type: 'file' }] },
            logs: []
        };
    }
    return {
        artifacts: {
            files: {
                'index.html': '<html><body></body></html>',
                'index.js': 'console.log("hello world");'
            }
        },
        logs: []
    };
};

async function main() {
    console.log('Running manifest verification...');
    // @ts-ignore
    const result = await runTask(mockTask, mockModel);

    const staticScore = result.metadata.staticScore;
    const manifest = staticScore?.sandboxManifest;

    if (manifest) {
        console.log('✅ Manifest generated:', manifest);
        if (manifest.entry === 'index.js') console.log('✅ Entry match');
        if (manifest.fileHashes['index.js']) console.log('✅ Hash match');
    } else {
        console.error('❌ No manifest found');
        process.exit(1);
    }

    // Check runtime result
    // If verifying manifest mismatch, we can try to inject a mismatch?
    // But standard run should be clean.
    const ann = result.metadata.finalResult?.failureAnnotations || [];
    const manifestMismatch = ann.find((a: any) => a.ruleId === 'runtime/manifest-mismatch');

    if (manifestMismatch) {
        console.error('❌ Found unexpected manifest mismatch:', manifestMismatch);
        process.exit(1);
    } else {
        console.log('✅ No manifest mismatch (Clean Run)');
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
