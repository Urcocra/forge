
const fs = require('fs');
const path = require('path');

const runsDir = 'd:\\Onlinebiz\\zerox\\gridsfeed\\backs\\RSE\\core\\runs';

try {
    const items = fs.readdirSync(runsDir);
    const runs = [];

    items.forEach(item => {
        const fullPath = path.join(runsDir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            // Parse name: model_name_timestamp
            // Example: anthropic_claude-sonnet-4.5_2026-01-16T04-09-48-290Z
            // split by last occurance of date pattern or just standard split if consistent
            // The timestamp always starts with 2026-

            const match = item.match(/^(.*)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/);
            if (match) {
                runs.push({
                    dir: fullPath,
                    model: match[1],
                    time: match[2],
                    timestamp: new Date(match[2].replace(/-/g, (m, offset) => {
                        // 2026-01-16T04-09-48-290Z -> 2026-01-16T04:09:48.290Z for parsing?
                        // Actually, Date.parse might fail specific format.
                        // Replacing - with : in time part might be needed.
                        return '-';
                    })).getTime() // simple string sort might be enough if format is strict ISO-like
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

        // Take top 3
        const top3 = grouped[model].slice(0, 3);

        let totalScore = 0;
        let count = 0;
        const details = [];

        top3.forEach(run => {
            const logPath = path.join(run.dir, 'stdout.log');
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8');
                // Find "Overall Score: 66/100" or similar
                // Based on previous view_file: "Overall Score: 66/100"
                const scoreMatch = content.match(/Overall Score:\s*(\d+)/);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1], 10);
                    totalScore += score;
                    count++;
                    details.push(score);
                } else {
                    // Try to find in JSON
                    const jsonMatch = content.match(/"overallScore":\s*(\d+)/);
                    if (jsonMatch) {
                        const score = parseInt(jsonMatch[1], 10);
                        totalScore += score;
                        count++;
                        details.push(score);
                    }
                }
            }
        });

        if (count > 0) {
            results.push({
                model: model,
                average: totalScore / count,
                runs: count,
                scores: details
            });
        }
    }

    // Sort by average desc
    results.sort((a, b) => b.average - a.average);

    let output = 'Model Name | Average Score | Runs | Scores\n';
    output += '--- | --- | --- | ---\n';
    results.forEach(r => {
        output += `${r.model} | ${r.average.toFixed(2)} | ${r.runs} | ${r.scores.join(', ')}\n`;
    });

    fs.writeFileSync('scores_output.txt', output);
    console.log('Done writing to scores_output.txt');

} catch (e) {
    console.error(e);
}
