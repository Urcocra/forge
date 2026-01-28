export interface RuntimeExternalAccess {
    type: 'script' | 'fetch' | 'xhr' | 'import' | 'other';
    target: string;
    resolved: boolean;
    timestamp: string;
}
