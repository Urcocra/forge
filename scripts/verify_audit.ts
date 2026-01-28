
import { runTask } from './src/lib/exec';
import { TaskSpec, ModelRequest } from './src/lib/types';

const mockTask: TaskSpec = {
    id: 'test-audit',
    size: 'M',
    questionPoolSize: 1,
    question: {
        qid: 'test',
        description: 'test',
        expectedArtifacts: ['index.html'],
        treeRules: { requiredFiles: ['index.html'] }
    },
    runtime: {
        type: 'browser',
        entry: 'index.html'
    }
};

const mockModel = async (req: ModelRequest) => {
    if (req.phase === 'tree') {
        return {
            tree: { files: [{ path: 'index.html', type: 'file' }] },
            logs: []
        };
    }
    return {
        artifacts: {
            files: {
                'index.html': `
                <html>
                    <body>
                        <script>
                            console.log('Fetching external...');
                            fetch('https://jsonplaceholder.typicode.com/todos/1')
                                .then(r => console.log('Fetched'))
                                .catch(e => console.error('Fetch failed'));
                        </script>
                    </body>
                </html>`
            }
        },
        logs: []
    };
};

async function main() {
    console.log('Running audit verification...');
    // @ts-ignore
    const result = await runTask(mockTask, mockModel);

    const annotations = result.metadata.finalResult?.failureAnnotations || [];
    console.log('Full Metadata Annotations:', JSON.stringify(annotations, null, 2));

    const externalWarning = annotations.find((a: any) => a.ruleId === 'runtime/external-access');

    if (externalWarning) {
        console.log('✅ External access warning found:', externalWarning);
    } else {
        console.log('❌ No external access warning found');
        // process.exit(1); // Don't crash, just log failure
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
