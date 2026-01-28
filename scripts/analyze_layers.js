
const fs = require('fs');
const path = require('path');

const runsDir = 'd:\\Onlinebiz\\zerox\\gridsfeed\\backs\\RSE\\core\\runs';
const outputFile = 'layer_stats_output.txt';

try {
    const items = fs.readdirSync(runsDir);
    const runs = [];

    items.forEach(item => {
        const fullPath = path.join(runsDir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            const match = item.match(/^(.*)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/);
            if (match) {
                runs.push({
                    dir: fullPath,
                    model: match[1],
                    time: match[2],
                    timestamp: match[2] // String sort is sufficient for ISO dates
                });
            }
        }
    });

    // Group by model
    const grouped = {};
    runs.forEach(r => {
        if (!grouped[r.model]) grouped[r.model] = [];
        grouped[r.model].push(r);
    });

    const results = [];

    for (const model in grouped) {
        // Sort by time desc
        grouped[model].sort((a, b) => b.time.localeCompare(a.time));

        // Take all runs
        const top3 = grouped[model]; // .slice(0, 3);

        let totalScore = 0;
        let totalL2L3 = 0;
        let totalL4L5 = 0;
        let count = 0;

        top3.forEach(run => {
            const logPath = path.join(run.dir, 'stdout.log');
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8');

                // Get Score
                let score = 0;
                const scoreMatch = content.match(/Overall Score:\s*(\d+)/);
                if (scoreMatch) {
                    score = parseInt(scoreMatch[1], 10);
                } else {
                    const jsonMatch = content.match(/"overallScore":\s*(\d+)/);
                    if (jsonMatch) score = parseInt(jsonMatch[1], 10);
                }

                // Count Layers
                // Look for layer: 'L2/...' or layer: "L2/..."
                // We match all occurrences in the file
                const layerMatches = content.matchAll(/layer['"]?:\s*['"](L[1-5])\//g);
                let l2 = 0, l3 = 0, l4 = 0, l5 = 0;

                for (const m of layerMatches) {
                    const layer = m[1]; // L1, L2, L3, L4, L5
                    if (layer === 'L2') l2++;
                    if (layer === 'L3') l3++;
                    if (layer === 'L4') l4++;
                    if (layer === 'L5') l5++;
                }

                totalScore += score;
                totalL2L3 += (l2 + l3);
                totalL4L5 += (l4 + l5);
                count++;
            }
        });

        if (count > 0) {
            results.push({
                model: model,
                avgScore: totalScore / count,
                avgL2L3: totalL2L3 / count,
                avgL4L5: totalL4L5 / count,
                runs: count
            });
        }
    }

    // Sort by average score desc
    results.sort((a, b) => b.avgScore - a.avgScore);

    let output = '| Rank | Model Name | Average Score | Avg L2/L3 Failures | Avg L4/L5 Failures |\n';
    output += '| :--- | :--- | :--- | :--- | :--- |\n';

    results.forEach((r, index) => {
        output += `| ${index + 1} | **${r.model}** | **${r.avgScore.toFixed(2)}** | ${r.avgL2L3.toFixed(2)} | ${r.avgL4L5.toFixed(2)} |\n`;
    });

    fs.writeFileSync(outputFile, output);
    console.log('Done writing to ' + outputFile);

} catch (e) {
    console.error(e);
}
