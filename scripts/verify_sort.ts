
interface Run {
    runId: string;
    timestamp: string;
    model: string;
}

const mockRuns: Run[] = [
    { runId: 'run1', timestamp: '2023-01-01T10:00:00Z', model: 'Model A' },
    { runId: 'run2', timestamp: '2023-01-02T10:00:00Z', model: 'Model B' }, // Newest
    { runId: 'run3', timestamp: '2022-12-31T10:00:00Z', model: 'Model C' }, // Oldest
    { runId: 'run4', timestamp: 'invalid-date', model: 'Model D' },
];

console.log('Original Order:');
mockRuns.forEach(r => console.log(`${r.runId}: ${r.timestamp}`));

// Sorting Logic to be implemented in SelectLog.astro
// We create a copy to avoid mutating the original prop if it were real
const sortedRuns = [...mockRuns].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();

    // Handle invalid dates by pushing them to the end (or beginning?)
    // If time is NaN, let's treat it as 0 (epoch) or -1
    const tA = isNaN(timeA) ? 0 : timeA;
    const tB = isNaN(timeB) ? 0 : timeB;

    return tB - tA; // Descending order (Newest first)
});

console.log('\nSorted Order (Newest First):');
sortedRuns.forEach(r => console.log(`${r.runId}: ${r.timestamp}`));

// Verification
const expectedOrder = ['run2', 'run1', 'run3', 'run4'];
const actualOrder = sortedRuns.map(r => r.runId);

const isEqual = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);

if (isEqual) {
    console.log('\nSUCCESS: Sorting logic works as expected.');
} else {
    console.error('\nFAILURE: Sorting logic produced unexpected order.');
    console.error('Expected:', expectedOrder);
    console.error('Actual:', actualOrder);
    process.exit(1);
}
