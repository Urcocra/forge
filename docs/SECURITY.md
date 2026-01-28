# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Do not open a GitHub issue if you discover a security vulnerability.**

If you discover a potential security vulnerability in FORGE (especially related to Sandbox escape or Execution isolation), please email us directly at [INSERT SECURITY EMAIL].

We will acknowledge your report within 48 hours and provide an estimated timeframe for a fix.

### Sandbox Limitations

Please note that `FORGE` uses "Essential Sandboxing" which is intended for research evaluation, not for running hostile malware. While we strive to isolate code execution, users should always run the benchmark in a containerized environment (like Docker) if evaluating untrusted models.
