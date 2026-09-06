---
id: TL-61-umu95e
type: tasklist
workstream: WS-60-imdumr
slug: electron-builder-publish-config
title: "Add a dormant GitHub Releases publish block to the electron-builder config"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-50-ody23m]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Add a dormant GitHub Releases publish block

`package.json` gains one new key: `build.publish`. It declares the `github` provider with an
obviously-fake placeholder `owner` and `repo`, plus the two behaviour keys this workstream
already decided — `releaseType: "draft"` and `publishAutoUpdate: true`.

The block is dormant. It starts no upload, needs no token, and changes no script.
`PublishManager` only builds a publisher when `isPublish` is true, and `isPublish` comes from
the `--publish` CLI flag or from three implicit triggers (an npm lifecycle event named
`release`, a CI tag, or `isCI`). None of them applies to this project, and the presence of a
`publish` config block is not one of them.

The one observable effect today is that `electron-builder` writes the update-manifest files
(`latest-mac.yml`, `latest-linux.yml`, `latest.yml`, and an embedded `app-update.yml`) into the
existing local `release/` output. Those files are the artefact a future auto-update mechanism
needs, and generating them now is the whole point of the workstream.

No runtime code change. No dependency added. No publish run. No edit outside `package.json`.

- [x] 1. Phase 1 — Add the publish block

  ```yaml
  description: "Insert the five-key publish object as the last key of the build object in package.json, and prove that nothing starts publishing."
  ```

  - [x] 1.1 Add `build.publish` to `package.json`
    ```yaml
    description: "Add a dormant github publish block as the last key of the build object in package.json, after the win block, changing nothing else in the file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open package.json and locate the build object. Its last key today is win. Add publish immediately after the win block, as the final key of build, so the three platform target blocks stay contiguous and the diff is one contiguous addition."
      - "The edit is small, mechanical, and targets one unambiguous location, so it is given as a literal block. Apply it exactly as written."
      - |
        package.json
        <<<<<<< SEARCH
            "win": {
              "target": [
                { "target": "nsis", "arch": ["x64", "arm64"] }
              ]
            }
          }
        }
        =======
            "win": {
              "target": [
                { "target": "nsis", "arch": ["x64", "arm64"] }
              ]
            },
            "publish": {
              "provider": "github",
              "owner": "TODO-REPLACE-OWNER",
              "repo": "TODO-REPLACE-REPO",
              "releaseType": "draft",
              "publishAutoUpdate": true
            }
          }
        }
        >>>>>>> REPLACE
      - "Use the placeholder strings TODO-REPLACE-OWNER and TODO-REPLACE-REPO verbatim. This is WS-59's existing convention, already shipped in src/lib/update-check.ts, and it is reused here on purpose so one grep for TODO-REPLACE covers both files. They are deliberate, unmistakable stand-ins. Do not substitute a real account, and do not invent a different placeholder convention. A grep for TODO-REPLACE across package.json and src/ returns five lines: package.json line 59 (owner) and line 60 (repo), and src/lib/update-check.ts line 23 (RELEASE_REPO_OWNER), line 24 (RELEASE_REPO_NAME) and line 40. Four of these are sites that need the real value — the two in package.json and the two constant assignments. The fifth, update-check.ts line 40, is the isReleaseRepoConfigured guard, which compares against the placeholder literals and must keep them unchanged forever."
      - "Write no token key and no credential of any kind. electron-builder reads GH_TOKEN or GITHUB_TOKEN from the environment at publish time."
      - "Write no other GithubOptions key. host, protocol, channel, vPrefixedTagName, tagNamePrefix, private, requestHeaders and timeout all have correct defaults for a plain github.com repository."
      - "Change nothing else: no script added or edited, no dependency added, no edit to README.md, and no edit under src/, electron/ or tools/."
    pattern: "package.json only. The build object, immediately after its win block. Nothing under src/, electron/, tools/, or README.md."
    imports: "None. No package is added. electron-updater is deliberately not installed, which is why the embedded app-update.yml has no reader and the placeholder in it is inert."
    compatibility: "electron-builder ^26, as pinned in devDependencies. app-builder-lib/scheme.json sets additionalProperties: false on both the top-level config and on GithubOptions, so every key written must be a real GithubOptions key. releaseType: draft and publishAutoUpdate: true are the current v26 defaults; they are written out on purpose, because package.json is strict JSON and cannot carry a comment, so the config block is the only place these two decisions can be recorded."
    gotcha: "package.json is strict JSON — a // comment or a _comment key both fail schema validation with Invalid configuration object, so do not try to annotate the block. The win block currently ends with a bare closing brace, so the comma after it is easy to miss and produces invalid JSON. Setting publishAutoUpdate: false would suppress the manifest files, which are the entire deliverable. Setting releaseType: release would make a future first publish go live without review. If any package:* script is ever run inside a CI environment, the isCI implicit trigger raises isPublish and the run fails with a 404 against TODO-REPLACE-OWNER; this is accepted, uploads nothing without a token, and is removed in electron-builder v27."
    verify:
      - "Run: node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\"))' — confirm exit 0."
      - "Run: grep -iE '\"token\"|gh_token|github_token|ghp_' package.json — confirm it returns nothing (exit 1)."
      - "Run: grep -c 'TODO-REPLACE' package.json — confirm it returns 2."
      - "Run: git diff --name-only — confirm the only entry is package.json, and nothing under electron/ or src/ is listed."
      - "Run: git diff package.json — confirm the scripts, devDependencies, mac, linux and win blocks are byte-identical to before, and the only change is the added publish object."
      - "Run: npm run build — confirm exit 0. This is the project's own compile and type-check step (three tsc projects plus tools/copy-assets.mjs); the repository has no lint script and no test script."
      - "Run: npm run package:mac with no --publish flag and no GH_TOKEN in the environment. Confirm exit 0, no 'Invalid configuration object' error, and no publishing step in the log."
      - "Confirm release/ still holds the four installers and their blockmaps — the dmg and zip pairs for x64 and arm64 — and now also holds latest-mac.yml."
      - "Open release/latest-mac.yml and confirm it names the built files and their hashes."
      - "Confirm 'release/mac-arm64/Praxis Board.app/Contents/Resources/app-update.yml' exists and carries provider: github with the placeholder owner and repo."
      - "Run: git tag — confirm the output is unchanged, and confirm no GitHub release was created."
      - "Launch the packaged app and confirm the board opens and renders as before."
      - "Run: npm start and confirm the browser board at http://localhost:4173 is unaffected. Run npm run electron:dev and confirm it behaves as before."
      - "Deferred, not runnable on this host: run npm run package:linux and confirm release/latest-linux.yml appears covering both the deb and the AppImage target, and run npm run package:win and confirm release/latest.yml appears. Both need cross-platform tooling this macOS host does not have (Docker for linux, Wine for windows), so run them on the next real cross-platform build. The mac run already proves the mechanism; the linux and windows paths differ only in which target writes the file."
    checklist:
      - "Does build.publish exist as the last key of build and hold exactly five keys — provider, owner, repo, releaseType, publishAutoUpdate — with provider 'github', releaseType 'draft' and publishAutoUpdate true?"
      - "Are the placeholders the literal strings TODO-REPLACE-OWNER and TODO-REPLACE-REPO — WS-59's convention, byte-identical to the constants in src/lib/update-check.ts — with no real account name anywhere?"
      - "Is package.json free of any token key and any credential, and does the grep in verify step 2 return nothing?"
      - "Is the scripts block byte-identical to its previous content, with no command line changed and no script added?"
      - "Is dependencies still absent, is devDependencies unchanged, and is electron-updater absent?"
      - "Does git diff --name-only list exactly one file, package.json, with nothing under electron/, src/, tools/ or README.md touched?"
    self_eval:
      passed: true
      failures: []
    ```
