# Security policy

Thank you for helping keep Aegis and the servers that use it safe.

## Supported versions

Only the latest release gets security fixes.

| Component | Supported | Not supported |
| --- | --- | --- |
| Bot | 3.6.x | 3.5.x and older |
| Web dashboard | 1.2.x | none older (1.2.0 was the first release) |

The running versions are shown in the website footer, at the bottom of every
dashboard page, and in `/about`.

## Reporting a vulnerability

**Please do not report security problems in public issues, pull requests,
discussions or Discord.**

Report them privately through GitHub:

1. Go to the repository's
   [Security tab](https://github.com/watispro1/AegisDeno/security).
2. Click **Report a vulnerability**
   ([direct link](https://github.com/watispro1/AegisDeno/security/advisories/new)).
   This opens a private security advisory that only the maintainers can see.

If the **Report a vulnerability** button is not available, open a public issue
that says only that you have a security report and would like a private way to
send it. Do not include any details in that issue.

### What to include

- What the problem is and what an attacker could do with it.
- Steps to reproduce it, or a proof of concept.
- The affected part (bot command, website route, `/api`, `/dashboard`) and the
  version.
- Anything you know about a fix or a workaround.

Please do not include real members' personal data. Use your own test server and
test accounts.

## Scope

In scope:

- The Aegis bot and its slash commands.
- The website at https://aegisdeno.fly.dev, its `/api` endpoints and the web
  dashboard under `/dashboard`.
- The code in this repository.

Out of scope:

- Discord, Fly.io, MongoDB and Top.gg themselves. Report problems with them to
  those companies.
- Denial-of-service or load testing, spam, social engineering, and physical
  attacks.
- Reports from automated scanners with no demonstrated impact.

When testing, do not access, change or delete data that is not yours, and do
not disrupt other servers.

## What to expect

The maintainer will acknowledge the report, investigate, and keep you updated in
the advisory. Aegis is maintained in spare time, so there are no guaranteed
response or fix times, but security reports are handled before other work.

Fixes ship as a normal release and are listed in
[`CHANGELOG.md`](./CHANGELOG.md) or
[`DASHBOARD_CHANGELOG.md`](./DASHBOARD_CHANGELOG.md). Once a fix is deployed the
advisory may be published, and you will be credited there if you would like to
be.

Machine-readable contact details are served at
https://aegisdeno.fly.dev/.well-known/security.txt, and a short version of this
policy is at https://aegisdeno.fly.dev/security.
