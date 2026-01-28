// Browser Runner Layer
// - Uses Playwright to load local HTML files in a headless browser
// - Captures console errors, page errors, and network failures
// - Returns structured, JSON-serializable error and log data
// - Never throws exceptions, always returns a result object

import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { RuntimeExternalAccess } from '../../types/audit';

/**
 * Browser error information (JSON serializable)
 */
export interface BrowserError {
    type: 'console.error' | 'pageerror' | 'network';
    timestamp: number;
    message: string;
    url?: string;
    status?: number;
}

/**
 * Browser log entry (JSON serializable)
 */
export interface BrowserLog {
    type: 'console.log' | 'console.warn' | 'console.info';
    timestamp: number;
    message: string;
}

/**
 * Result returned by browser runner
 */
export interface BrowserRunnerResult {
    browserErrors: BrowserError[];
    browserLogs: BrowserLog[];
    externalAccess: RuntimeExternalAccess[];
}

/**
 * Runs the specified HTML file in a headless Chromium browser and captures errors/logs.
 * 
 * @param htmlFilePath - Absolute path to the HTML file to load
 * @param timeoutMs - Maximum time to wait for page load (default: 10000ms)
 * @returns A promise resolving to structured browser errors and logs
 * 
 * @remarks
 * - Never throws exceptions; errors are captured in the result
 * - All returned data is JSON serializable
 * - Does not perform any success/failure determination
 * - Automatically closes browser after execution
 */
export async function runInBrowser(
    htmlFilePath: string,
    timeoutMs: number = 10000
): Promise<BrowserRunnerResult> {
    const browserErrors: BrowserError[] = [];
    const browserLogs: BrowserLog[] = [];
    const externalAccess: RuntimeExternalAccess[] = [];

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        // Validate HTML file exists
        if (!fs.existsSync(htmlFilePath)) {
            browserErrors.push({
                type: 'pageerror',
                timestamp: Date.now(),
                message: `HTML file not found: ${htmlFilePath}`
            });
            return { browserErrors, browserLogs, externalAccess };
        }

        // Launch headless Chromium
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();

        // ---------------------------------------------------------
        // 1. Console & Error Listeners
        // ---------------------------------------------------------
        page.on('console', (msg) => {
            const timestamp = Date.now();
            const messageText = msg.text();

            if (msg.type() === 'error') {
                browserErrors.push({
                    type: 'console.error',
                    timestamp,
                    message: messageText
                });
            } else if (msg.type() === 'log') {
                browserLogs.push({
                    type: 'console.log',
                    timestamp,
                    message: messageText
                });
            } else if (msg.type() === 'warning') {
                browserLogs.push({
                    type: 'console.warn',
                    timestamp,
                    message: messageText
                });
            } else if (msg.type() === 'info') {
                browserLogs.push({
                    type: 'console.info',
                    timestamp,
                    message: messageText
                });
            }
        });

        page.on('pageerror', (error) => {
            browserErrors.push({
                type: 'pageerror',
                timestamp: Date.now(),
                message: error.message || String(error)
            });
        });

        page.on('requestfailed', (request) => {
            const failure = request.failure();
            // Network failures are errors
            browserErrors.push({
                type: 'network',
                timestamp: Date.now(),
                message: failure?.errorText || 'Unknown network error',
                url: request.url(),
                status: undefined
            });

            // Audit Log (Failed)
            const resourceType = request.resourceType();
            if (['script', 'fetch', 'xhr'].includes(resourceType)) {
                externalAccess.push({
                    type: resourceType as any,
                    target: request.url(),
                    resolved: false,
                    timestamp: new Date().toISOString()
                });
            }
        });

        page.on('response', (response) => {
            const status = response.status();
            if (status >= 400) {
                browserErrors.push({
                    type: 'network',
                    timestamp: Date.now(),
                    message: `HTTP ${status} ${response.statusText()}`,
                    url: response.url(),
                    status
                });
            }
        });

        // ---------------------------------------------------------
        // 2. Audit Listeners (Network Activity)
        // ---------------------------------------------------------
        page.on('requestfinished', (request) => {
            const resourceType = request.resourceType();
            if (['script', 'fetch', 'xhr'].includes(resourceType)) {
                externalAccess.push({
                    type: resourceType as any,
                    target: request.url(),
                    resolved: true,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // ---------------------------------------------------------
        // 3. Navigation
        // ---------------------------------------------------------
        const fileUrl = `file:///${path.resolve(htmlFilePath).replace(/\\/g, '/')}`;

        await page.goto(fileUrl, {
            timeout: timeoutMs,
            waitUntil: 'networkidle'
        });

        await page.waitForTimeout(1000);

    } catch (error) {
        browserErrors.push({
            type: 'pageerror',
            timestamp: Date.now(),
            message: `Browser runner error: ${(error as Error).message || String(error)}`
        });
    } finally {
        try {
            if (page) await page.close();
            if (browser) await browser.close();
        } catch { }
    }

    return { browserErrors, browserLogs, externalAccess };
}

/**
 * Runs an HTML file in the browser and returns only errors (convenience function).
 * 
 * @param htmlFilePath - Absolute path to the HTML file to load
 * @param timeoutMs - Maximum time to wait for page load (default: 10000ms)
 * @returns A promise resolving to an array of browser errors
 */
export async function getBrowserErrors(
    htmlFilePath: string,
    timeoutMs: number = 10000
): Promise<BrowserError[]> {
    const result = await runInBrowser(htmlFilePath, timeoutMs);
    return result.browserErrors;
}

/**
 * Runs an HTML file in the browser and returns only logs (convenience function).
 * 
 * @param htmlFilePath - Absolute path to the HTML file to load
 * @param timeoutMs - Maximum time to wait for page load (default: 10000ms)
 * @returns A promise resolving to an array of browser logs
 */
export async function getBrowserLogs(
    htmlFilePath: string,
    timeoutMs: number = 10000
): Promise<BrowserLog[]> {
    const result = await runInBrowser(htmlFilePath, timeoutMs);
    return result.browserLogs;
}
