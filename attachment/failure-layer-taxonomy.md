# Failure-Layer Taxonomy

This document defines the L1–L4 failure-layer taxonomy used in FORGE with concrete examples.

## Failure Layer Definitions

### L0 - Non-failure / Pass
*   **Definition**: Project executes successfully with no required errors.
*   **Log Signature**: Exit code 0, no patterns matching L1-L5.

### L1 - Soft Quality Issues
*   **Definition**: Lint warnings, style issues, or excessive logging.
*   **Log Signature**:
    ```text
    WARN: Variable 'x' is defined but never used.
    [ESLint] Warning: Missing semicolon at line 12.
    ```

### L2 - Code-Level Errors
*   **Definition**: Correctness errors detectable by static analysis (e.g., syntax errors, reference errors).
*   **Log Signature**:
    ```text
    ReferenceError: 'utils' is not defined
    TypeError: Cannot read properties of undefined (reading 'map')
    ```

### L3 - Static Contract Failure
*   **Definition**: Missing required files or invalid structural schemas.
*   **Log Signature**:
    ```text
    [StaticCheck] Error: Required file 'src/api/routes.ts' not found.
    [JSONParse] Error: Unexpected token } in JSON at position 42.
    ```

### L4 - Runtime Execution Failure
*   **Definition**: Project fails to start or crashes immediately during execution.
*   **Log Signature**:
    ```text
    [Runtime] Error: Process exited with code 1.
    [Sandbox] Error: Entry point 'index.js' failed to export 'main'.
    ZeroScore: Runtime score is 0.
    ```

### L5 - Environment / Browser Failure
*   **Definition**: Failures caused by the environment, network, or sandbox infrastructure, not the code itself (though handled as failure).
*   **Log Signature**:
    ```text
    PuppeteerError: ERR_CONNECTION_REFUSED
    TimeoutError: Task exceeded 60000ms limit.
    [Sandbox] Violation: Script attempted to access '/etc/passwd'.
    ```
