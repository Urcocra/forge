export interface SandboxManifest {
    entry: string;
    filesMounted: string[];
    fileHashes: Record<string, string>;
    generatedAt: string;
}
