---
id: IL-8-275q0s
type: issuelist
workstream: WS-50-wnvfyq
slug: security-hardening
title: "Security audit findings — path handling, process robustness, resource limits"
status: done
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: [TL-50-5dft3e]
---

# PRX Issue List

- [x] ISS-14-qwcmik. Electron IPC writes and recursively deletes paths taken unvalidated from the renderer

  ```yaml
  id: ISS-14-qwcmik
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "The install and remove IPC handlers accept a filesystem path from the renderer and use it directly as a write and delete target. installSelected receives targets: InstallTargetRequest[] and passes target.basePath through unchecked. installToTarget then builds the write path by string concatenation of basePath and relativePath, calls mkdir with recursive: true, and writes the file. There is no absolute-path check, no canonicalisation of the joined path, no containment assertion against basePath, and no confirmation in the main process. removeInstallation reads existing.resolvedPath from .praxis-installs.json, a path the renderer originally chose, and calls fs.rm(path, { recursive: true, force: true }). Classification: CWE-20, CWE-22, CWE-73; OWASP A01. Confidence: CONFIRMED."
  steps_to_reproduce:
    - "Call window.praxisSkillInstallAPI.installSelected from the renderer with a target whose basePath points outside any tool configuration directory, or with a relativePath that walks upward."
    - "Observe that installToTarget creates the directories and writes the file at the concatenated path, with no validation in the main process."
    - "Call window.praxisSkillInstallAPI.removeInstallation for a record whose resolvedPath points at an unrelated directory."
    - "Observe that fs.rm runs with recursive: true and force: true on that path."
  expected: "The main process resolves basePath and the final write path, and refuses any target that does not sit inside a permitted root derived from TOOL_CATALOGUE detection results or the registered project roots. Renderer-supplied paths are never trusted."
  actual: "The renderer-supplied path is used as-is. Files are created or overwritten anywhere the OS user can write, and a renderer-chosen directory tree is deleted recursively."
  affected: "electron/agentic-tools-ipc-handlers.cts:284-309 (installSelected), electron/agentic-tools-ipc-handlers.cts:321-331 (removeInstallation), src/lib/agentic-tools-install.ts:90-96, src/lib/agentic-tools-install.ts:151-164, src/lib/agentic-tools-fs-adapter.ts:105-107, electron/preload.cts:26-33"
  environment: "Electron desktop build, all platforms"
  tasks: [TL-50-5dft3e.1]
  notes: "Remediation direction from the audit: validate in the main process, not the renderer. Resolve basePath, require it inside a small allowlist, and reject anything else before installToTarget or removeInstallation runs. Chains with ISS-15-8a4w1p, which can put attacker-authored script behind the preload bridge."
  ```

- [x] ISS-15-8a4w1p. Fixed loopback port has no listen error handler, and the Electron window loads whatever answers on it

  ```yaml
  id: ISS-15-8a4w1p
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "Port 4173 is a fixed constant in both src/server.ts:12 and electron/main.cts:15, never randomised and never verified. If another local process already holds 127.0.0.1:4173, the app's own server.listen fails with EADDRINUSE, and because src/server.ts:332 registers no error listener the failure becomes an uncaught exception in the main process. waitForServer then polls the port, receives a 200 from the process that squatted it, and createWindow calls loadURL on that address with preload.cjs attached, exposing praxisSkillInstallAPI.installSelected and .removeInstallation to whatever page answered. waitForServer only checks that something responds; it never checks that the responder is this app's server. The window also sets no will-navigate handler and no setWindowOpenHandler restriction. Classification: CWE-346, CWE-1188; OWASP A05. Confidence: PLAUSIBLE."
  steps_to_reproduce:
    - "Bind 127.0.0.1:4173 with an unrelated local process that answers 200 on GET /."
    - "Start the packaged Electron app."
    - "Observe that the app's server.listen raises EADDRINUSE with no error listener attached."
    - "Observe whether waitForServer succeeds against the squatting process and createWindow loads its page with the preload bridge attached."
  expected: "The server reports a bind failure through a handled error path, and the window loads only a page served by this app's own server, verified rather than assumed."
  actual: "EADDRINUSE surfaces as an uncaught main-process exception, and waitForServer treats any 200 response on the fixed port as proof the app's server is running."
  affected: "electron/main.cts:15 (SERVER_URL), electron/main.cts:19-37 (waitForServer), electron/main.cts:39-49 (createWindow), electron/main.cts:51-93, src/server.ts:12, src/server.ts:332"
  environment: "Electron desktop build; requires a second local process able to bind the port first"
  tasks: [TL-50-5dft3e.2.1, TL-50-5dft3e.2.2]
  notes: "OPEN QUESTION recorded from the audit: the EADDRINUSE-as-uncaught-exception mechanics were verified directly, but it is not established whether Electron's main-process exception dialog still lets app.whenReady() proceed to createWindow() after the user dismisses it. This needs a real run of the packaged app against a squatted port before the exploit half is treated as confirmed. Remediation direction from the audit: bind an ephemeral port in src/server.ts, pass the chosen port back to electron/main.cts instead of the shared constant, and have waitForServer verify a startup nonce the server echoes before loadURL runs. Chains into ISS-14-qwcmik."
  ```

- [x] ISS-16-oqvwh2. Skill archive is buffered and decompressed with no size limit, freezing the Electron main process

  ```yaml
  id: ISS-16-oqvwh2
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "getInstallContent calls await res.arrayBuffer() on the archive response with no cap on the number of bytes buffered, then calls gunzipSync(gz) with no maxOutputLength option. Both steps run synchronously in the Electron main process. A small gzip archive that expands to many gigabytes exhausts memory and blocks the main process for the whole decompression. Classification: CWE-409, CWE-400; OWASP A05. Confidence: CONFIRMED. This is independent of which URL the archive is fetched from."
  steps_to_reproduce:
    - "Point the skill content fetch at an archive whose compressed size is small but whose decompressed size is several gigabytes."
    - "Trigger a skill install so getInstallContent runs."
    - "Observe memory growth during res.arrayBuffer() and the main process blocking inside gunzipSync."
  expected: "The response size is capped before it is buffered, and the gunzip call is given a maxOutputLength so an oversized archive fails fast with an error instead of consuming the process."
  actual: "The full response is buffered with no cap and decompressed with no output limit. The app hangs or is killed, and the main process stays frozen for the duration because gunzipSync is synchronous."
  affected: "src/lib/skill-content-fetch.ts:172-174 (getInstallContent)"
  environment: "Electron desktop build, main process"
  tasks: [TL-50-5dft3e.3]
  notes: "Remediation direction from the audit: cap the response size before buffering, and pass maxOutputLength to the gunzip call."
  ```

- [x] ISS-17-78kw69. Tar entry exclusion check misses backslashes, so entry names escape the target directory on Windows

  ```yaml
  id: ISS-17-78kw69
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "isExcluded rejects a path segment that starts with a dot, which blocks a literal .. segment on POSIX, but it never inspects the segment for backslashes. A tar entry named praxis/skills/ok/sub\\..\\..\\..\\..\\evil.md passes every check because the segment starts with s. The resulting relative path reaches the write sink, where the final path is built by concatenation with basePath and no containment assertion. On Windows, fs.writeFile normalises the backslashes and the write lands outside the intended skill directory. The same gap applies to the skill id itself. Classification: CWE-22 (tar slip); OWASP A01. Confidence: CONFIRMED for the missing guard and the concatenation sink. This is independent of which URL the archive is fetched from."
  steps_to_reproduce:
    - "Build a skill archive containing an entry whose name embeds backslash separators and upward traversal inside a single segment, for example praxis/skills/ok/sub\\..\\..\\..\\..\\evil.md."
    - "Run the skill install on Windows."
    - "Observe that isExcluded accepts the segment and the file is written outside the tool configuration directory."
  expected: "Any tar segment containing a backslash, a forward slash, or a colon, or equal to .., is rejected, and the final write path is resolved and asserted to stay under basePath before the write."
  actual: "Only a leading dot is checked. Backslash-bearing segments pass and, on Windows, the write escapes the intended directory."
  affected: "src/lib/skill-content-fetch.ts:48-50 (isExcluded), src/lib/skill-content-fetch.ts:183-206, src/lib/agentic-tools-format.ts:31-42, src/lib/agentic-tools-install.ts:90-96"
  environment: "Windows only for the escape; the app ships a package:win target"
  tasks: [TL-50-5dft3e.4.1, TL-50-5dft3e.4.2]
  notes: "Remediation direction from the audit: tighten isExcluded, and resolve and assert the final write path in installToTarget."
  ```

- [x] ISS-18-47kypg. Static file server uses a prefix comparison with no separator boundary

  ```yaml
  id: ISS-18-47kypg
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "The static branch guards the resolved file path with filePath.startsWith(root), a raw string comparison with no separator boundary. path.join collapses .. first, so a real escape such as /../lib/projects.js is correctly rejected, but a sibling directory whose name merely begins with public is not. It was verified directly that /../public-backup/a.txt resolves to dist/public-backup/a.txt and passes the startsWith check. Classification: CWE-22, CWE-23; OWASP A01. Confidence: CONFIRMED for the flawed check and its reachability."
  steps_to_reproduce:
    - "Request /../public-backup/a.txt from the running server."
    - "Observe that the joined path resolves to dist/public-backup/a.txt and satisfies filePath.startsWith(root)."
  expected: "The guard compares against root plus path.sep, or uses path.relative(root, filePath) and rejects a result that is absolute or starts with .., so only paths inside the public directory are served."
  actual: "Any sibling under dist/ whose name begins with the string public is treated as inside the served root."
  affected: "src/server.ts:300-308"
  environment: "Node HTTP server, all platforms"
  tasks: [TL-50-5dft3e.5]
  notes: "There is no impact today: dist/ holds only electron, lib, public, scripts, and server.js, so no matching sibling exists. The check becomes an arbitrary read of one directory tree as soon as a public-prefixed sibling appears under dist/, such as a backup copy, a .bak, or a future build artefact."
  ```
