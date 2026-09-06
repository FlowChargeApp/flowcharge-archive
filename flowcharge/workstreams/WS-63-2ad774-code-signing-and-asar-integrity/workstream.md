---
id: WS-63-2ad774
type: workstream
workstream: WS-63-2ad774
slug: code-signing-and-asar-integrity
title: "Code-sign the packaged app and enable ASAR integrity"
description: "Sign the macOS and Windows builds and enable Electron's ASAR integrity fuses, so the archive's tamper-detection is backed by an actual signature rather than an editable, unsigned check."
status: done
tags: [hardening, electron, packaging, security, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [WS-61-xq11uw]
links: []
---

Sign the macOS and Windows Electron builds, then enable Electron's ASAR integrity fuses so the archive's tamper-detection is backed by an actual signature.

This came out of the same source-hardening consultation as WS-61/WS-62 (11-step ordered plan). This workstream covers step 6. Important constraint established during the consultation: enable `EnableEmbeddedAsarIntegrityValidation: true` and `OnlyLoadAppFromAsar: true` only together with code signing — the integrity hash lives inside the binary, and an unsigned binary (and its fuses) can simply be edited, so integrity checking without a real signature adds almost nothing. This step also only detects tampering (a changed archive); it adds no confidentiality and does not hide code.

Signing itself needs an Apple Developer Program enrolment and a Windows code-signing certificate (Azure Trusted Signing or an OV certificate) — this is tracked as a manual, external action in Praxis-Business's pre-launch checklist (strategy/04-pre-launch-checklist.md, row 17), not something an agent can obtain. This workstream's plan should record that dependency as an explicit assumption/open question rather than block on it: it may plan and task the electron-builder config wiring (the electronFuses keys, the signing identity configuration slots) so the work is ready to go the moment a certificate exists, while being honest that the wiring cannot be verified end-to-end without one.
