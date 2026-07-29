# Development dependency advisory review

This record documents an unresolved development-tool advisory. It is not an assertion that the
vulnerability is harmless and it is not automatic approval to release.

## GHSA-mh99-v99m-4gvg / CVE-2026-14257

- Package: `brace-expansion`
- Severity: high
- Vulnerable versions: `<=5.0.7`
- Patched versions: `>=5.0.8`
- Effect: specially constructed brace patterns can cause unbounded expansion length and terminate
  a Node.js process through memory exhaustion.

The complete audit reports these paths:

```text
@jest/globals > @jest/expect > jest-snapshot > @jest/transform >
babel-plugin-istanbul > test-exclude > minimatch > brace-expansion@1.1.16

jest > @jest/core > @jest/reporters > glob > minimatch > brace-expansion@2.1.2
```

Both begin at API `devDependencies` and are used by Jest transformation, coverage exclusion,
reporting, and globbing. `pnpm audit --prod` reports no vulnerability, and neither audited path is
part of the deployed API or web runtime dependency graph.

Repository CI invokes Jest with repository-controlled configuration and test paths. It does not
accept brace or glob patterns from public application requests. This reduces CI exposure but does
not eliminate the vulnerable code or the risk of malicious repository changes, compromised
dependencies, or unsafe operator-supplied test arguments.

## Remediation assessment

The available fix is `brace-expansion >=5.0.8`. The affected dependants currently declare
incompatible major ranges resolving through `brace-expansion` 1.x and 2.x. Forcing 5.x would
violate those contracts. Updating the aligned direct Jest packages from 30.2.0 to the latest
available 30.4.1 was tested and retained the same vulnerable paths, so that experiment was
reverted. TypeScript was not upgraded and no framework was replaced.

## Compensating controls and follow-up

- Keep `pnpm audit --prod` a mandatory blocking CI gate.
- Run the complete `pnpm audit` in CI with visible output under an explicitly named temporary-risk
  step.
- Keep CI test/glob arguments repository-controlled and review changes to test configuration.
- Do not run CI jobs from untrusted code with production credentials.
- Recheck when Jest, `@jest/reporters`, `babel-plugin-istanbul`, `test-exclude`, `glob`, or
  `minimatch` publishes a compatible update that adopts the patched major.
- Recheck whenever the advisory changes or before each production release.

Risk review owner: [Foundation to assign]

Risk review date: [Foundation to approve]

This is a temporary accepted-risk proposal only. Foundation approval remains required before
production release, and the complete validation result must remain reported as non-zero until the
dependency graph is patched.
