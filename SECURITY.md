## Reporting a vulnerability

Report a vulnerability through GitHub private vulnerability reporting:
<https://github.com/FlowChargeApp/flowcharge/security/advisories/new>. Do not open a
public issue for a security report. Reports are received by one solo maintainer,
Anthony Koukoullis.

## What to include

- The released version, or the build identifier the binary reports.
- The operating system and the architecture you ran it on.
- Steps to reproduce.
- The impact you believe it has.

## What to expect

Acknowledgement within 7 days. Best effort thereafter. There is no fix deadline,
because this project has one unpaid maintainer. A 90-day default coordinated-disclosure
window applies, negotiable on the advisory thread. Credit in the advisory unless you
decline. There is no bug bounty, and none is planned.

## Supported versions

Only the latest published release is supported. Below `1.0.0` there is no compatibility
promise; a fix ships as a new release, never as a patch to an older tag.

## Scope

**In scope:** the behaviour of the released binary itself: arbitrary file read or
write and path traversal reachable through its local HTTP API, unsafe handling of a
project folder path you supply, and unsafe download or archive extraction in the skill
install and update mechanism. Also in scope: the release build and publish path that
produces and signs off the published binaries.

**Out of scope:** defects in third-party tools such as GitHub itself or the agentic
coding tool the skills run in; and what your own projects contain, since the application
reads whatever project folders you point it at and renders their contents.
