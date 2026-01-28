# Failure Taxonomy Definitions

> This report is automatically generated from the rule registry.

## L5/BrowserRuntime
- `runtime/crash` (critical): Browser page crashed or encountered a fatal error
- `runtime/console` (error): Console error detected
- `runtime/network` (error): Critical network resource failed to load
- `runtime/timeout` (error): Execution timed out
- `runtime/manifest-mismatch` (error): Runtime artifacts do not match sandbox manifest

## L4/Parse
- `parse/json` (error): File includes invalid JSON
- `parse/tree` (error): Required file structure missing
- `parse/artifacts` (warning): Required artifact files are empty or missing content

## L3/StaticValidation
- `connectivity/link` (error): File reference or link is broken
- `connectivity/binding` (error): HTML/JS data binding mismatch
- `connectivity/schema` (error): API Schema not correctly implemented in code
- `connectivity/route` (error): Route configuration is inconsistent

## L2/CodeQuality
- `lint/level-a` (error): Critical code quality issue (Level A)
- `lint/level-b` (warning): Code quality warning (Level B)
- `lint/level-c` (info): Style suggestion (Level C)

## L1/Warnings
- `runtime/external-access` (warning): External resource accessed

## L1/Model
- `model/no-output` (error): Model failed to generate output
