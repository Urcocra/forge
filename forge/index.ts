#!/usr/bin/env node

import { run } from './run';
import { reproduce } from './reproduce';
import { compare } from './compare';
import { report } from './report';
import { batch } from './batch';
import * as fs from 'fs';
import * as path from 'path';
import * as esg from './esg';

/**
 * ==============================
 * FORGE CLI Entry
 * ==============================
 */
async function main() {
    const [, , cmd, ...args] = process.argv;

    try {
        switch (cmd) {
            /**
             * forge run --config <config.json>
             */
            case 'run': {
                const flag = args[0];
                const configPath = args[1];

                if (flag !== '--config' || !configPath) {
                    throw new Error('Usage: forge run --config <config.json>');
                }

                await run(configPath);
                break;
            }

            /**
             * forge batch --config <config.json> --times <N>
             */
            case 'batch': {
                const configIdx = args.indexOf('--config');
                const timesIdx = args.indexOf('--times');

                if (configIdx === -1 || timesIdx === -1) {
                    throw new Error('Usage: forge batch --config <config.json> --times <number>');
                }

                const configPath = args[configIdx + 1];
                const times = parseInt(args[timesIdx + 1], 10);

                await batch(configPath, times);
                break;
            }

            /**
             * forge reproduce <runDir>
             */
            case 'reproduce': {
                const runDir = args[0];
                if (!runDir) {
                    throw new Error('Usage: forge reproduce <runDir>');
                }
                reproduce(runDir);
                break;
            }

            /**
             * forge compare
             */
            case 'compare':
                compare();
                break;

            /**
             * forge report <runDir>
             */
            case 'report': {
                const runDir = args[0];
                if (!runDir) {
                    throw new Error('Usage: forge report <runDir>');
                }
                report(runDir);
                break;
            }

            /**
             * forge esg <runDir>
             */
            case 'esg': {
                const runDir = args[0];
                if (!runDir) {
                    throw new Error('Usage: forge esg <runDir>');
                }
                esg.generateESGReport(runDir);
                break;
            }

            /**
             * forge esg-report <runDir>
             * (Markdown only, requires esg_report.json)
             */
            case 'esg-report': {
                const runDir = args[0];
                if (!runDir) {
                    throw new Error('Usage: forge esg-report <runDir>');
                }
                const jsonPath = path.join(runDir, 'esg_report.json');
                if (!fs.existsSync(jsonPath)) {
                    console.error('[ESG] run.json/esg_report.json missing. Run "forge esg <runDir>" first.');
                    process.exit(1);
                }
                const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                esg.generateESGMarkdownReport(runDir, report);
                break;
            }

            /**
             * forge eval-report <runDir>
             * (Generates eval_evaluation_report.md)
             */
            case 'eval-report': {
                const runDir = args[0];
                if (!runDir) {
                    throw new Error('Usage: forge eval-report <runDir>');
                }
                // Dynamic import to avoid cycles or load issues
                const { generateEvalMarkdownReport } = require('./eval-report');
                generateEvalMarkdownReport(runDir);
                break;
            }

            /**
             * Help
             */
            default:
                console.log(`
FORGE CLI

Commands:
  forge run --config <config.json>
  forge batch --config <config.json> --times <N>
  forge reproduce <runDir>
  forge compare
  forge report <runDir>
  forge esg <runDir>
  forge esg-report <runDir>
  forge eval-report <runDir>
`);
        }
    } catch (e: any) {
        console.error('[FORGE ERROR]', e.message);
        process.exit(1);
    }
}

main();