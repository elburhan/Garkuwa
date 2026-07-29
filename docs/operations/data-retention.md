# Data-retention decision record

The application does not automatically delete operational records. Retention is intentionally
policy-driven because the data classes have different privacy, evidentiary, security, and
institutional requirements.

Before launch, authorized stakeholders must approve periods and legal-hold behavior for:

- incident reports, location fields, status and assignment histories;
- encrypted optional reporter contacts and contact-access audit records;
- internal staff notes and immutable revisions;
- private attachment objects, metadata, content-access history, and security-review history;
- staff identities, authentication sessions, and lockout metadata;
- news and institutional editorial drafts, revisions, publication histories, and archives;
- application/security logs and backups.

The approved policy must define the retention trigger, deletion authority, backup expiry,
legal/investigation holds, audit evidence, encryption-key retirement, and restoration implications.
Deletion jobs, object lifecycle rules, anonymization, and legal-hold tooling are not implemented in
this hardening task. Operators must not invent periods or manually delete records without approval.
