---
id: TL-103-9npvav
type: tasklist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Skill install target resolution and lifecycle fixes"
status: ready
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: [IL-16-78bnrq]
links: []
mode: diff
base_commit: f0b0a8c
---

# FlowCharge Tasks

## Skill install target resolution and lifecycle

Four of eight tool-and-scope combinations install FlowCharge Core into a directory
the target tool never reads, and report success. Removal deletes one file of many.
An update never deletes the previous generation. Two unit tests assert the defective
paths as correct.

One structural gap causes the path defects: `IntegrationFormat` states which scopes a
`pathTemplate` is valid at only in a free-text `notes` string that no code reads.
Task 1 closes that gap by adding a machine-readable `scopes` array that
`selectPrimaryFormat` filters on. Task 2 supplies the catalogue data for Claude Code
and OpenCode. A second record-shape gap causes the lifecycle defects:
`InstallRecord.resolvedPath` is a single string. Task 4 adds an optional
`resolvedPaths` array beside it, which tasks 5, 6 and 10 then build on.

**Execution order is load bearing.** Tasks touch eight files more than once, and every
SEARCH block is quoted as the file will stand at the moment that task runs. Run the
tasks strictly top to bottom.

**Two build states you should expect, and must not "fix":**

- After task 1.1 and until task 2.2 lands, `npx tsc --noEmit -p tsconfig.json` fails.
  `scopes` becomes a required field, and tasks 1 and 2 annotate different catalogue
  entries. Task 2.2 carries the first clean type-check.
- After task 1 and until task 7.2 lands, `dist/test/unit/agentic-tools-install.test.js`
  fails. Those failures are the two assertions ISS-37-niiof1 was filed against. Task 7
  corrects them. Do not revert a source change to make them pass.

Baseline measurements, taken at `f0b0a8c` with `dist/` built from it: the install unit
suite passes 10 of 10, the format unit suite passes 10 of 10, `grep -c "scopes:"
src/lib/agentic-tools-catalogue.ts` returns 0, and `grep -rn "resolvedPaths" src`
returns no lines.

- [x] 1. Make format selection scope-aware (ISS-33-6bxf6h)

  ```yaml
  description: "Add a machine-readable scopes array to IntegrationFormat, filter selectPrimaryFormat on it, and annotate the Cursor and Windsurf entries so a global install stops writing a project-relative template under a configDir."
  ```

  - [x] 1.1 Add `scopes` to the `IntegrationFormat` interface
    ```yaml
    description: "Declare the scopes an integration format is valid at as data, not as free text in notes."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-catalogue.ts
        <<<<<<< SEARCH
        export interface IntegrationFormat {
          kind: 'skill-directory' | 'rule-directory' | 'single-rule-file'
              | 'mcp-json' | 'markdown-context-file' | 'structured-config-file';
          pathTemplate: string; // e.g. 'skills/<name>/SKILL.md', relative to configDir or project root
          deprecatedFallback?: string;
          notes?: string;
        }
        =======
        export interface IntegrationFormat {
          kind: 'skill-directory' | 'rule-directory' | 'single-rule-file'
              | 'mcp-json' | 'markdown-context-file' | 'structured-config-file';
          pathTemplate: string; // e.g. 'skills/<name>/SKILL.md', relative to configDir or project root
          // The scopes this entry is a valid install target at, as data the
          // selector reads rather than as prose in `notes`. A 'global' entry's
          // pathTemplate is relative to the tool's resolved configDir; a
          // 'project' entry's is relative to the project root. Order inside
          // integrationFormats still carries priority: selectPrimaryFormat
          // takes the FIRST implemented entry valid at the requested scope.
          scopes: ('global' | 'project')[];
          deprecatedFallback?: string;
          notes?: string;
        }
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-catalogue.ts, the IntegrationFormat interface only."
    imports: "None. The literal union is written inline so this data-only file keeps its zero imports."
    compatibility: "This file must never import FsAccess or perform detection. InstallScope lives in agentic-tools-install-tracking.ts, which imports FROM this file, so it must not be imported here."
    gotcha: "scopes is required, so every catalogue entry and every test fixture that builds an IntegrationFormat must gain it. The type-check stays red until task 2.2."
    verify:
      - "grep -n \"scopes: ('global' | 'project')\\[\\];\" src/lib/agentic-tools-catalogue.ts — returns no match at f0b0a8c (exit 1); returns exactly one line after this task."
      - "grep -c '^import' src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c and must still return 0."
    checklist:
      - "The scopes field is present on IntegrationFormat and is required, not optional."
      - "The file still has zero import statements."
      - "No InstallScope type is imported or referenced."
      - "No catalogue entry was edited by this task."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Annotate the Cursor integration formats
    ```yaml
    description: "Cursor reads .cursor/rules/*.mdc from a project root, so both its entries are project-scope only and a global install resolves to no format."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-catalogue.ts
        <<<<<<< SEARCH
            integrationFormats: [
              {
                kind: 'rule-directory',
                pathTemplate: '.cursor/rules/*.mdc',
                deprecatedFallback: '.cursorrules',
                notes: 'Markdown + frontmatter rule files; .cursorrules is the deprecated single-file fallback.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: '.cursor/mcp.json',
                notes: 'Project-level MCP server config; global config lives at ~/.cursor/mcp.json (configDir).',
              },
            ],
        =======
            integrationFormats: [
              {
                kind: 'rule-directory',
                pathTemplate: '.cursor/rules/*.mdc',
                scopes: ['project'],
                deprecatedFallback: '.cursorrules',
                notes: 'Markdown + frontmatter rule files, read from a project root; .cursorrules is the deprecated single-file fallback. Cursor has no user-level rules directory, so there is no global install target here.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: '.cursor/mcp.json',
                scopes: ['project'],
                notes: 'Project-level MCP server config; global config lives at ~/.cursor/mcp.json (configDir).',
              },
            ],
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-catalogue.ts, the Cursor entry's integrationFormats array only."
    imports: "None."
    compatibility: "Cursor therefore has no implemented format at global scope. installToTarget answers 'skipped-no-format' for that pair, which the modal renders as 'No format for this tool'. That is the ineligibility report ISS-33-6bxf6h's expected outcome allows."
    gotcha: "Do not invent a user-level Cursor rules path. The issue states Cursor reads rules from a project root only."
    verify:
      - "grep -n \"scopes: \\['project'\\],\" src/lib/agentic-tools-catalogue.ts — returns no match at f0b0a8c (exit 1); returns two lines after this task."
    checklist:
      - "Both Cursor entries carry scopes: ['project']."
      - "No Cursor entry declares 'global'."
      - "pathTemplate, deprecatedFallback and kind values are unchanged."
      - "No other tool's entry was edited."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Annotate the Windsurf integration formats
    ```yaml
    description: "Windsurf reads .devin/rules/*.md and .windsurfrules from a project root, and its one user-level surface is a user-authored rules document, so both project entries are project-scope only and a global install resolves to no format."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-catalogue.ts
        <<<<<<< SEARCH
            integrationFormats: [
              {
                kind: 'rule-directory',
                pathTemplate: '.devin/rules/*.md',
                deprecatedFallback: '.windsurf/rules/*.md',
                notes: '.devin/rules/*.md now takes precedence; .windsurf/rules/*.md is the fallback.',
              },
              {
                kind: 'single-rule-file',
                pathTemplate: '.windsurfrules',
                notes: 'Legacy single-file format, superseded by the rule-directory formats above.',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'memories/global_rules.md',
                notes: 'Relative to configDir; global (user-level) rules, not project-scoped.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: 'mcp_config.json',
                notes: 'Relative to configDir. Corroborated by three independent secondary sources but not independently confirmed against docs.devin.ai directly this pass.',
              },
            ],
        =======
            integrationFormats: [
              {
                kind: 'rule-directory',
                pathTemplate: '.devin/rules/*.md',
                scopes: ['project'],
                deprecatedFallback: '.windsurf/rules/*.md',
                notes: '.devin/rules/*.md now takes precedence; .windsurf/rules/*.md is the fallback. Both are read from a project root.',
              },
              {
                kind: 'single-rule-file',
                pathTemplate: '.windsurfrules',
                scopes: ['project'],
                notes: 'Legacy single-file format at the project root, superseded by the rule-directory formats above.',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'memories/global_rules.md',
                scopes: [],
                notes: 'Relative to configDir; global (user-level) rules, not project-scoped. Recorded for reference and declared at NO scope: this file is the user-authored Windsurf rules document, and the markdown-context-file writer replaces its whole target with one combined skill document, so installing here would destroy what the user wrote. Windsurf therefore has no global install target.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: 'mcp_config.json',
                scopes: ['global'],
                notes: 'Relative to configDir. Corroborated by three independent secondary sources but not independently confirmed against docs.devin.ai directly this pass.',
              },
            ],
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-catalogue.ts, the Windsurf entry's integrationFormats array only."
    imports: "None."
    compatibility: "Windsurf therefore has no implemented format at global scope. installToTarget answers 'skipped-no-format' for that pair, which the modal renders as 'No format for this tool'. That is the ineligibility report ISS-33-6bxf6h's expected outcome allows, and it is the same treatment task 1.2 gives Cursor at global scope. The same sentence in that issue also names markdown-context-file as the Windsurf global target. That branch is not taken: singleDocumentWrite produces one combined document from every skill body, and the install writes it with writeTextFileAtomic, which replaces memories/global_rules.md outright, with no backup and no warning."
    gotcha: "Do not give markdown-context-file scopes: ['global']. It is the first implemented entry in this array, so selectPrimaryFormat would return it at global scope and every Windsurf global install would overwrite the user-authored rules file. Do not invent another user-level Windsurf rules path either."
    verify:
      - "grep -c \"scopes: \\['project'\\],\" src/lib/agentic-tools-catalogue.ts — returns 2 after task 1.2; must return 4 after this task."
      - "grep -c 'scopes: \\[\\],' src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "grep -c \"scopes: \\['global'\\],\" src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c (exit 1); returns exactly 1 after this task, the unimplemented mcp-json entry."
    checklist:
      - "rule-directory and single-rule-file carry scopes: ['project']."
      - "markdown-context-file carries an empty scopes array, so it is an install target at no scope."
      - "mcp-json carries scopes: ['global'] and stays an unimplemented kind, so it is never selected."
      - "Array order is unchanged, so project scope still resolves to rule-directory first."
      - "No pathTemplate value was changed."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Filter `selectPrimaryFormat` on the requested scope
    ```yaml
    description: "selectPrimaryFormat takes the install scope kind and skips any format not declared valid at it."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-format.ts
        <<<<<<< SEARCH
        // Returns the first integrationFormats entry whose kind formatForTarget
        // actually implements (i.e. skips every kind in UNIMPLEMENTED_KINDS), or
        // null if the tool has no such format at all.
        export function selectPrimaryFormat(tool: ToolDefinition): IntegrationFormat | null {
          return tool.integrationFormats.find((f) => !UNIMPLEMENTED_KINDS.has(f.kind)) ?? null;
        }
        =======
        // Returns the first integrationFormats entry whose kind formatForTarget
        // actually implements (i.e. skips every kind in UNIMPLEMENTED_KINDS) AND
        // that declares itself valid at the requested scope, or null if the tool
        // has no such format at all. The scope filter is what stops a
        // project-relative pathTemplate being joined to a configDir base, and a
        // configDir-relative one being joined to a project root.
        export function selectPrimaryFormat(
          tool: ToolDefinition,
          scopeKind: 'global' | 'project',
        ): IntegrationFormat | null {
          return tool.integrationFormats.find(
            (f) => !UNIMPLEMENTED_KINDS.has(f.kind) && f.scopes.includes(scopeKind),
          ) ?? null;
        }
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-format.ts, selectPrimaryFormat only."
    imports: "None. IntegrationFormat and ToolDefinition are already imported as types."
    compatibility: "This file must never know about FsWriteAccess, tool ids or IPC. The scope kind arrives as a plain string literal union, so it stays true."
    gotcha: "The second argument is required. Every call site must pass it; tasks 1.5 and 1.6 update the two production call sites."
    verify:
      - "grep -n 'scopeKind: .global. | .project.,' src/lib/agentic-tools-format.ts — returns no match at f0b0a8c (exit 1); returns one line after this task."
      - "grep -n 'export function selectPrimaryFormat(tool: ToolDefinition): IntegrationFormat' src/lib/agentic-tools-format.ts — returns line 27 at f0b0a8c; must return no match after this task."
    checklist:
      - "selectPrimaryFormat takes two parameters."
      - "The find predicate tests both UNIMPLEMENTED_KINDS and f.scopes."
      - "formatForTarget is unchanged."
      - "No import was added to this file."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Pass the target scope at the install call site
    ```yaml
    description: "installToTarget already knows its scope; hand it to the selector."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
          const format = selectPrimaryFormat(target.tool);
        =======
          const format = selectPrimaryFormat(target.tool, target.scope.kind);
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, one line inside installToTarget."
    imports: "None. selectPrimaryFormat is already imported."
    compatibility: "InstallScope is a discriminated union, so target.scope.kind is already 'global' | 'project'."
    gotcha: "The anchor is unique in this file (grep -c returns 1 at f0b0a8c). Tasks 3, 4, 5, 6, 9 and 10 edit other regions of this same file later; they quote their own text."
    verify:
      - "grep -c 'selectPrimaryFormat(target.tool, target.scope.kind)' src/lib/agentic-tools-install.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "The call passes target.scope.kind."
      - "No other line in installToTarget changed."
      - "No import changed."
      - "The null branch below the call is untouched."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.6 Pass the global scope at the presence-check call site
    ```yaml
    description: "checkSkillPresence is documented as running at global scope only, so it selects the global format explicitly."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/lib/agentic-tools-skill-presence.ts
        <<<<<<< SEARCH
          const format = selectPrimaryFormat(tool);
        =======
          // 'global' is a literal, not a parameter: presence checking is a
          // documented global-scope-only capability, so this module has no
          // project scope to forward.
          const format = selectPrimaryFormat(tool, 'global');
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-skill-presence.ts, one line inside checkSkillPresence."
    imports: "None. selectPrimaryFormat is already imported."
    compatibility: "checkSkillPresence's signature is unchanged, so src/http/routes-integrations.ts:205 and the Electron handler both keep compiling untouched."
    gotcha: "Do not add a scope parameter to checkSkillPresence. Widening it to project scope is out of scope for this issue and the global-only limit is deliberate."
    verify:
      - "grep -c \"selectPrimaryFormat(tool, 'global')\" src/lib/agentic-tools-skill-presence.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "The call passes the literal 'global'."
      - "checkSkillPresence's parameter list is unchanged."
      - "No caller of checkSkillPresence needed an edit."
      - "The comment records why the literal is correct."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.7 Add `scopes` to the format-test fixtures
    ```yaml
    description: "The two shared IntegrationFormat fixtures gain the now-required field."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/test/unit/agentic-tools-format.test.ts
        <<<<<<< SEARCH
        const skillDirectoryFormat: IntegrationFormat = {
          kind: 'skill-directory',
          pathTemplate: 'skills/<name>/SKILL.md',
        };

        const mcpJsonFormat: IntegrationFormat = {
          kind: 'mcp-json',
          pathTemplate: '.mcp.json',
        };
        =======
        const skillDirectoryFormat: IntegrationFormat = {
          kind: 'skill-directory',
          pathTemplate: 'skills/<name>/SKILL.md',
          scopes: ['global'],
        };

        const mcpJsonFormat: IntegrationFormat = {
          kind: 'mcp-json',
          pathTemplate: '.mcp.json',
          scopes: ['global'],
        };
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-format.test.ts, the two module-level fixtures."
    imports: "None."
    compatibility: "Edited only because scopes is required from task 1.1; without it this file does not compile."
    gotcha: "Both fixtures are used by the selection tests updated in task 1.9, which call the selector at 'global'."
    verify:
      - "grep -c \"scopes: \\['global'\\],\" src/test/unit/agentic-tools-format.test.ts — returns 0 at f0b0a8c (exit 1); returns 2 after this task."
    checklist:
      - "Both fixtures carry scopes."
      - "No test body changed in this task."
      - "kind and pathTemplate values are unchanged."
      - "twoSkillContent is untouched."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.8 Add `scopes` to the structured-config-file fixture
    ```yaml
    description: "The inline fixture inside the not-yet-implemented-kind test gains the now-required field."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/test/unit/agentic-tools-format.test.ts
        <<<<<<< SEARCH
          const structuredConfigFile: IntegrationFormat = { kind: 'structured-config-file', pathTemplate: 'settings.json' };
        =======
          const structuredConfigFile: IntegrationFormat = { kind: 'structured-config-file', pathTemplate: 'settings.json', scopes: ['global'] };
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-format.test.ts, one line inside the generic-throw test."
    imports: "None."
    compatibility: "Edited only because scopes is required from task 1.1."
    gotcha: "This fixture is passed straight to formatForTarget, which never reads scopes; the field is there for the type only."
    verify:
      - "grep -c \"structured-config-file', pathTemplate: 'settings.json', scopes\" src/test/unit/agentic-tools-format.test.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "The inline fixture carries scopes."
      - "The assertion in that test is unchanged."
      - "No other line changed."
      - "The fixture is still typed as IntegrationFormat."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.9 Update the `selectPrimaryFormat` tests for scope-aware selection
    ```yaml
    description: "The five selection tests pass a scope, and the Cursor and Windsurf cases assert the corrected global behaviour."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/test/unit/agentic-tools-format.test.ts
        <<<<<<< SEARCH
        test('selectPrimaryFormat returns the first non-mcp-json entry', () => {
          const tool = {
            id: 'fixture-tool',
            displayName: 'Fixture Tool',
            category: 'cli' as const,
            configDir: {},
            integrationFormats: [mcpJsonFormat, skillDirectoryFormat],
          };
          assert.deepEqual(selectPrimaryFormat(tool), skillDirectoryFormat);
        });

        test('selectPrimaryFormat returns null when only mcp-json is available', () => {
          const tool = {
            id: 'fixture-tool',
            displayName: 'Fixture Tool',
            category: 'cli' as const,
            configDir: {},
            integrationFormats: [mcpJsonFormat],
          };
          assert.equal(selectPrimaryFormat(tool), null);
        });

        test('selectPrimaryFormat resolves the real Cursor catalogue entry to its rules format, never mcp-json', () => {
          const cursor = catalogueTool('cursor');
          const resolved = selectPrimaryFormat(cursor);
          assert.notEqual(resolved, null);
          assert.equal(resolved?.kind, 'rule-directory');
          assert.notEqual(resolved?.kind, 'mcp-json');
        });

        test('selectPrimaryFormat resolves the real Windsurf catalogue entry to its rules format, never mcp-json', () => {
          const windsurf = catalogueTool('windsurf');
          const resolved = selectPrimaryFormat(windsurf);
          assert.notEqual(resolved, null);
          assert.equal(resolved?.kind, 'rule-directory');
          assert.notEqual(resolved?.kind, 'mcp-json');
        });

        test('selectPrimaryFormat resolves the real OpenCode catalogue entry to its skill-directory format, never structured-config-file', () => {
          const opencode = catalogueTool('opencode');
          const resolved = selectPrimaryFormat(opencode);
          assert.notEqual(resolved, null);
          assert.equal(resolved?.kind, 'skill-directory');
          assert.notEqual(resolved?.kind, 'structured-config-file');
        });
        =======
        test('selectPrimaryFormat returns the first non-mcp-json entry valid at the scope', () => {
          const tool = {
            id: 'fixture-tool',
            displayName: 'Fixture Tool',
            category: 'cli' as const,
            configDir: {},
            integrationFormats: [mcpJsonFormat, skillDirectoryFormat],
          };
          assert.deepEqual(selectPrimaryFormat(tool, 'global'), skillDirectoryFormat);
        });

        test('selectPrimaryFormat returns null when only mcp-json is available', () => {
          const tool = {
            id: 'fixture-tool',
            displayName: 'Fixture Tool',
            category: 'cli' as const,
            configDir: {},
            integrationFormats: [mcpJsonFormat],
          };
          assert.equal(selectPrimaryFormat(tool, 'global'), null);
        });

        test('selectPrimaryFormat returns null for a format the tool does not declare at that scope', () => {
          const tool = {
            id: 'fixture-tool',
            displayName: 'Fixture Tool',
            category: 'cli' as const,
            configDir: {},
            integrationFormats: [skillDirectoryFormat],
          };
          assert.equal(selectPrimaryFormat(tool, 'project'), null);
        });

        test('selectPrimaryFormat resolves the real Cursor catalogue entry to its rules format at project scope only', () => {
          const cursor = catalogueTool('cursor');
          const atProject = selectPrimaryFormat(cursor, 'project');
          assert.equal(atProject?.kind, 'rule-directory');
          assert.equal(atProject?.pathTemplate, '.cursor/rules/*.mdc');
          // Cursor reads no user-level rules directory, so a global install has
          // no target at all rather than a doubled configDir path.
          assert.equal(selectPrimaryFormat(cursor, 'global'), null);
        });

        test('selectPrimaryFormat resolves the real Windsurf catalogue entry to its rules format at project scope only', () => {
          const windsurf = catalogueTool('windsurf');
          const atProject = selectPrimaryFormat(windsurf, 'project');
          assert.equal(atProject?.kind, 'rule-directory');
          assert.equal(atProject?.pathTemplate, '.devin/rules/*.md');
          // Windsurf's one user-level surface is memories/global_rules.md, the
          // user-authored rules document, which the catalogue declares at no
          // scope. A global install therefore has no target at all rather than
          // one combined document written over that file.
          assert.equal(selectPrimaryFormat(windsurf, 'global'), null);
        });

        test('selectPrimaryFormat resolves the real OpenCode catalogue entry to its skill-directory format, never structured-config-file', () => {
          const opencode = catalogueTool('opencode');
          const resolved = selectPrimaryFormat(opencode, 'global');
          assert.notEqual(resolved, null);
          assert.equal(resolved?.kind, 'skill-directory');
          assert.notEqual(resolved?.kind, 'structured-config-file');
        });
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-format.test.ts, the five selectPrimaryFormat tests as one contiguous region."
    imports: "None."
    compatibility: "The two formatForTarget tests above this region, and the two mcp-json throw tests below it, are untouched."
    gotcha: "This region is contiguous at f0b0a8c (lines 79-123) and no earlier task in this list edits it. Tasks 1.7 and 1.8 edit lines above it only."
    verify:
      - "grep -c \"selectPrimaryFormat(cursor, 'global'), null\" src/test/unit/agentic-tools-format.test.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "After task 2.2 lands: npm run build && node --test dist/test/unit/agentic-tools-format.test.js — 10 of 10 pass at f0b0a8c; must report 11 pass, 0 fail after this task."
    checklist:
      - "Every selectPrimaryFormat call in the file passes a scope."
      - "The Cursor test asserts null at global scope."
      - "The Windsurf test asserts null at global scope."
      - "No formatForTarget test was changed."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.10 Add `scopes` to the install-test no-format fixture
    ```yaml
    description: "The inline mcp-json-only tool in the install suite gains the now-required field."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/test/unit/agentic-tools-install.test.ts
        <<<<<<< SEARCH
            integrationFormats: [{ kind: 'mcp-json' as const, pathTemplate: '.mcp.json' }],
        =======
            integrationFormats: [{ kind: 'mcp-json' as const, pathTemplate: '.mcp.json', scopes: ['global' as const] }],
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-install.test.ts, one line inside the skipped-no-format test."
    imports: "None."
    compatibility: "Edited only because scopes is required from task 1.1."
    gotcha: "The object is a plain literal, not annotated as IntegrationFormat, so the scope value needs its own `as const` to narrow from string[]."
    verify:
      - "grep -c \"scopes: \\['global' as const\\]\" src/test/unit/agentic-tools-install.test.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "The fixture carries scopes."
      - "The as const narrowing is present."
      - "The assertions in that test are unchanged."
      - "No other region of this file changed in this task."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.11 Add `scopes` to the presence-test fixtures
    ```yaml
    description: "The three IntegrationFormat fixtures in the presence suite gain the now-required field."
    author: Anthony Koukoullis
    issues: [ISS-33-6bxf6h]
    implement:
      - |
        src/test/unit/agentic-tools-skill-presence.test.ts
        <<<<<<< SEARCH
        const skillDirectoryFormat: IntegrationFormat = {
          kind: 'skill-directory',
          pathTemplate: 'skills/<name>/SKILL.md',
        };

        const singleRuleFileFormat: IntegrationFormat = {
          kind: 'single-rule-file',
          pathTemplate: '.windsurfrules',
        };

        const mcpJsonFormat: IntegrationFormat = {
          kind: 'mcp-json',
          pathTemplate: '.mcp.json',
        };
        =======
        // Every fixture here is exercised through checkSkillPresence, which
        // selects at 'global', so each one declares that scope.
        const skillDirectoryFormat: IntegrationFormat = {
          kind: 'skill-directory',
          pathTemplate: 'skills/<name>/SKILL.md',
          scopes: ['global'],
        };

        const singleRuleFileFormat: IntegrationFormat = {
          kind: 'single-rule-file',
          pathTemplate: '.windsurfrules',
          scopes: ['global'],
        };

        const mcpJsonFormat: IntegrationFormat = {
          kind: 'mcp-json',
          pathTemplate: '.mcp.json',
          scopes: ['global'],
        };
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-skill-presence.test.ts, the three module-level fixtures."
    imports: "None."
    compatibility: "The one real-catalogue test in this file uses OpenCode at global scope, which still resolves to skill-directory after task 2.2, so that test keeps passing unchanged."
    gotcha: "checkSkillPresence now selects at 'global' (task 1.6). A fixture declaring only 'project' would make its test return checkKind 'no-format'."
    verify:
      - "grep -c \"scopes: \\['global'\\],\" src/test/unit/agentic-tools-skill-presence.test.ts — returns 0 at f0b0a8c (exit 1); returns 3 after this task."
      - "After task 2.2 lands: npm run build && node --test dist/test/unit/agentic-tools-skill-presence.test.js — must report 0 fail."
    checklist:
      - "All three fixtures carry scopes: ['global']."
      - "No test body changed."
      - "The OpenCode real-catalogue test is untouched."
      - "kind and pathTemplate values are unchanged."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Give Claude Code and OpenCode their project-scope targets (ISS-34-mpy9n0)

  ```yaml
  description: "Annotate the Claude Code and OpenCode catalogue entries, adding the .claude/ and .opencode/ prefixed project-scope skill directories each tool actually reads, so a project install stops writing a top-level skills/ directory no tool reads."
  ```

  - [x] 2.1 Annotate the Claude Code integration formats and add its project-scope skill directory
    ```yaml
    description: "Claude Code reads project skills from <projectRoot>/.claude/skills/, which exists today only in a free-text note."
    author: Anthony Koukoullis
    issues: [ISS-34-mpy9n0]
    implement:
      - |
        src/lib/agentic-tools-catalogue.ts
        <<<<<<< SEARCH
            integrationFormats: [
              {
                kind: 'skill-directory',
                pathTemplate: 'skills/<name>/SKILL.md',
                notes: 'Relative to configDir (user-level) or .claude/ at the project root (project-level).',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'CLAUDE.md',
                notes: 'Read from the project root; a user-level copy may also live under configDir.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: '.mcp.json',
                notes: 'Project-root MCP server config; user-level MCP config lives in configDir.',
              },
              {
                kind: 'structured-config-file',
                pathTemplate: 'settings.json',
                notes: 'Relative to configDir (user-level) or .claude/ at the project root (project-level).',
              },
            ],
        =======
            integrationFormats: [
              {
                kind: 'skill-directory',
                pathTemplate: 'skills/<name>/SKILL.md',
                scopes: ['global'],
                notes: 'Relative to configDir, at user level.',
              },
              {
                // The project-level counterpart of the entry above. The note on
                // that entry stated this .claude/ prefix in prose; it is a
                // separate, scope-tagged entry now so the selector can reach it.
                kind: 'skill-directory',
                pathTemplate: '.claude/skills/<name>/SKILL.md',
                scopes: ['project'],
                notes: 'Relative to the project root; Claude Code reads project skills from <projectRoot>/.claude/skills/.',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'CLAUDE.md',
                scopes: ['project'],
                notes: 'Read from the project root; a user-level copy may also live under configDir. Never selected, because the skill-directory entries above it are implemented and win at both scopes.',
              },
              {
                kind: 'mcp-json',
                pathTemplate: '.mcp.json',
                scopes: ['project'],
                notes: 'Project-root MCP server config; user-level MCP config lives in configDir.',
              },
              {
                kind: 'structured-config-file',
                pathTemplate: 'settings.json',
                scopes: ['global'],
                notes: 'Relative to configDir, at user level.',
              },
            ],
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-catalogue.ts, the Claude Code entry's integrationFormats array only."
    imports: "None."
    compatibility: "Array order carries priority. The two skill-directory entries sit first, so neither CLAUDE.md nor .mcp.json can ever be selected as a skill install target."
    gotcha: "Order matters. If markdown-context-file were moved above the project skill-directory entry, a project install would overwrite the project's own CLAUDE.md."
    verify:
      - "grep -c \"pathTemplate: '.claude/skills/<name>/SKILL.md'\" src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "Claude Code has five format entries, two of them skill-directory."
      - "The project-scope entry's pathTemplate starts with .claude/."
      - "Both skill-directory entries precede markdown-context-file."
      - "Every entry carries scopes."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Annotate the OpenCode integration formats and add its project-scope skill directory
    ```yaml
    description: "OpenCode reads project skills from <projectRoot>/.opencode/skills/<name>/SKILL.md (https://opencode.ai/docs/skills/, checked 2026-09-10), which the catalogue names nowhere today, so project scope resolved to the configDir-relative template instead."
    author: Anthony Koukoullis
    issues: [ISS-34-mpy9n0]
    implement:
      - |
        src/lib/agentic-tools-catalogue.ts
        <<<<<<< SEARCH
            integrationFormats: [
              {
                kind: 'structured-config-file',
                pathTemplate: 'opencode.json',
                notes: 'Runtime config, relative to configDir; opencode.jsonc is an accepted alternate extension.',
              },
              {
                kind: 'structured-config-file',
                pathTemplate: 'tui.json',
                notes: 'TUI settings, relative to configDir.',
              },
              {
                kind: 'skill-directory',
                pathTemplate: 'skills/<name>/SKILL.md',
                notes: 'Relative to configDir, alongside sibling agents/, commands/, modes/, plugins/, tools/, and themes/ subdirectories.',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'AGENTS.md',
                notes: 'Read from the project root automatically; a global copy also lives at AGENTS.md under configDir.',
              },
            ],
        =======
            integrationFormats: [
              {
                kind: 'structured-config-file',
                pathTemplate: 'opencode.json',
                scopes: ['global'],
                notes: 'Runtime config, relative to configDir; opencode.jsonc is an accepted alternate extension.',
              },
              {
                kind: 'structured-config-file',
                pathTemplate: 'tui.json',
                scopes: ['global'],
                notes: 'TUI settings, relative to configDir.',
              },
              {
                kind: 'skill-directory',
                pathTemplate: 'skills/<name>/SKILL.md',
                scopes: ['global'],
                notes: 'Relative to configDir, at user level, alongside sibling agents/, commands/, modes/, plugins/, tools/, and themes/ subdirectories.',
              },
              {
                // The project-level counterpart of the entry above, the same
                // shape Claude Code has: OpenCode reads project skills from
                // <projectRoot>/.opencode/skills/ (https://opencode.ai/docs/skills/).
                kind: 'skill-directory',
                pathTemplate: '.opencode/skills/<name>/SKILL.md',
                scopes: ['project'],
                notes: 'Relative to the project root; OpenCode reads project skills from <projectRoot>/.opencode/skills/.',
              },
              {
                kind: 'markdown-context-file',
                pathTemplate: 'AGENTS.md',
                scopes: ['global'],
                notes: 'A global copy lives at AGENTS.md under configDir. The project-root AGENTS.md OpenCode also reads is a user-authored file, never a skill install target, so it is not declared at project scope.',
              },
            ],
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-catalogue.ts, the OpenCode entry's integrationFormats array only."
    imports: "None."
    compatibility: "OpenCode at project scope now resolves to .opencode/skills/<name>/SKILL.md under the project root, the same shape task 2.1 gives Claude Code, so a project install lands where OpenCode reads instead of in a top-level skills/ directory. The project-root AGENTS.md stays undeclared at project scope."
    gotcha: "AGENTS.md must not be declared at project scope. If it were, a project install would concatenate every skill body over the project's own AGENTS.md. Order matters too: the project skill-directory entry must sit above AGENTS.md, and the two structured-config-file entries above it are unimplemented kinds the selector skips."
    verify:
      - "grep -c \"scopes: \\['global'\\],\" src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c (exit 1), and 3 after task 2.1, being the Windsurf mcp-json entry from task 1.3 plus the two Claude Code entries from task 2.1; must return 7 after this task, the four pre-existing OpenCode entries annotated here."
      - "grep -c \"pathTemplate: '.opencode/skills/<name>/SKILL.md'\" src/lib/agentic-tools-catalogue.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "npx tsc --noEmit -p tsconfig.json — passes at f0b0a8c, fails from task 1.1 onward, and must pass again from here. This is the first clean type-check in the sequence."
      - "npx tsc --noEmit -p src/public/tsconfig.json — passes at f0b0a8c and must still pass."
      - |
        npm run build && node --input-type=module -e "
        import { TOOL_CATALOGUE } from './dist/lib/agentic-tools-catalogue.js';
        import { selectPrimaryFormat } from './dist/lib/agentic-tools-format.js';
        const t = (id) => TOOL_CATALOGUE.find((x) => x.id === id);
        const s = (id, k) => { const f = selectPrimaryFormat(t(id), k); return f === null ? 'null' : f.kind + ' :: ' + f.pathTemplate; };
        for (const id of ['claude-code','cursor','windsurf','opencode']) for (const k of ['global','project']) console.log(id + '/' + k, '=', s(id, k));
        "
        At f0b0a8c this prints rule-directory for cursor/global, rule-directory for windsurf/global,
        and skills/<name>/SKILL.md for both claude-code/project and opencode/project — the four
        defective pairs. After this task it must print exactly:
        claude-code/global = skill-directory :: skills/<name>/SKILL.md
        claude-code/project = skill-directory :: .claude/skills/<name>/SKILL.md
        cursor/global = null
        cursor/project = rule-directory :: .cursor/rules/*.mdc
        windsurf/global = null
        windsurf/project = rule-directory :: .devin/rules/*.md
        opencode/global = skill-directory :: skills/<name>/SKILL.md
        opencode/project = skill-directory :: .opencode/skills/<name>/SKILL.md
    checklist:
      - "The four pre-existing OpenCode entries carry scopes: ['global'], and the new skill-directory entry carries scopes: ['project']."
      - "Both type-checks pass."
      - "The eight-pair probe prints exactly the eight lines above."
      - "The project-scope entry's pathTemplate starts with .opencode/ and sits above AGENTS.md."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Remove the unreachable `installAllGlobal` (ISS-43-xszeei)

  ```yaml
  description: "Delete the exported function no production caller reaches, its only test, and the imports that existed for it alone."
  ```

  - [x] 3.1 Drop the `GetInstallContent` type import
    ```yaml
    description: "That type is imported for installAllGlobal's signature and nothing else."
    author: Anthony Koukoullis
    issues: [ISS-43-xszeei]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
        import type { InstallContent, GetInstallContent } from './agentic-tools-content.js';
        =======
        import type { InstallContent } from './agentic-tools-content.js';
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, one import line."
    imports: "Removes one type-only import. InstallContent stays, used by installToTarget."
    compatibility: "GetInstallContent remains exported from agentic-tools-content.ts; only this consumer goes."
    gotcha: "Apply this before task 3.2 removes the function, or the import looks used while you read the file."
    verify:
      - "grep -c 'GetInstallContent' src/lib/agentic-tools-install.ts — returns 2 at f0b0a8c; must return 1 after this task and 0 after task 3.2."
    checklist:
      - "The import names InstallContent only."
      - "No other import line changed."
      - "The file still imports node:path."
      - "hashInstallContent is still imported."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Delete the `installAllGlobal` function
    ```yaml
    description: "Remove the function and the comment block that documents it."
    author: Anthony Koukoullis
    issues: [ISS-43-xszeei]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
        // Runs installToTarget for every catalogue tool at global scope, resolving
        // each tool's basePath via the caller-supplied resolveGlobalBasePath and its
        // InstallContent via the caller-supplied getInstallContent (the still-
        // placeholder Gap 1 port) — one getInstallContent call per target per run, no
        // caching layer, per plan Assumption 6. Each tool is isolated in its own
        // try/catch: a tool whose selectPrimaryFormat resolves to null already
        // returns 'skipped-no-format' from installToTarget without throwing, but a
        // tool whose primary format is a kind formatForTarget does not implement
        // (e.g. OpenCode's real catalogue entry resolves to a structured-config-file
        // format, out of scope for this workstream) throws instead — caught here and
        // folded into the same 'skipped-no-format' result, so one tool's failure
        // never aborts the batch for the remaining tools.
        export async function installAllGlobal(
          catalogue: ToolDefinition[],
          resolveGlobalBasePath: (tool: ToolDefinition) => string,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess; getInstallContent: GetInstallContent },
        ): Promise<InstallResult[]> {
          const results: InstallResult[] = [];
          for (const tool of catalogue) {
            try {
              const basePath = resolveGlobalBasePath(tool);
              const content = await deps.getInstallContent(tool.id);
              const target: InstallTarget = { tool, basePath, scope: { kind: 'global' } };
              const result = await installToTarget(target, content, registryPath, { fsWrite: deps.fsWrite });
              results.push(result);
            } catch {
              results.push({ toolId: tool.id, status: 'skipped-no-format', resolvedPath: null });
            }
          }
          return results;
        }

        =======
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, the installAllGlobal comment block, function, and the blank line after it."
    imports: "None added. ToolDefinition stays imported: InstallTarget's tool field uses it."
    compatibility: "Nothing outside the unit test calls this function. The Electron IPC handler builds its own per-target loop and does not import it."
    gotcha: "The REPLACE side is deliberately empty. Keep the blank line separation between writeRegistry's caller above and the removeInstallation comment below."
    verify:
      - "grep -c 'installAllGlobal' src/lib/agentic-tools-install.ts — returns 1 at f0b0a8c; must return 0 after this task."
      - "npx tsc --noEmit -p tsconfig.json — must still pass once task 3.4 has removed the test's use of it."
    checklist:
      - "installAllGlobal appears nowhere in the file."
      - "removeInstallation and its comment are intact."
      - "installToTarget is intact."
      - "ToolDefinition is still imported and still used by InstallTarget."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Drop the test imports that existed only for that function
    ```yaml
    description: "ToolDefinition, GetInstallContent and the installAllGlobal binding are used only by the test task 3.4 removes."
    author: Anthony Koukoullis
    issues: [ISS-43-xszeei]
    implement:
      - |
        src/test/unit/agentic-tools-install.test.ts
        <<<<<<< SEARCH
        import type { ToolDefinition } from '../../lib/agentic-tools-catalogue.js';
        import type { GetInstallContent, InstallContent } from '../../lib/agentic-tools-content.js';
        import type { FsWriteAccess, InstallTarget } from '../../lib/agentic-tools-install.js';
        import { installAllGlobal, installToTarget, removeInstallation } from '../../lib/agentic-tools-install.js';
        =======
        import type { InstallContent } from '../../lib/agentic-tools-content.js';
        import type { FsWriteAccess, InstallTarget } from '../../lib/agentic-tools-install.js';
        import { installToTarget, removeInstallation } from '../../lib/agentic-tools-install.js';
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-install.test.ts, four contiguous import lines."
    imports: "Removes three unused bindings. The TOOL_CATALOGUE import on the line above stays: claudeCode() and cursor() use it."
    compatibility: "Task 1.10 edited line 156 of this file, well below this region, so this SEARCH text is unchanged from f0b0a8c."
    gotcha: "Do not remove the TOOL_CATALOGUE value import immediately above these lines."
    verify:
      - "grep -c 'installAllGlobal' src/test/unit/agentic-tools-install.test.ts — returns 5 at f0b0a8c; must return 4 after this task and 0 after task 3.4."
    checklist:
      - "The import list names InstallContent, FsWriteAccess, InstallTarget, installToTarget and removeInstallation only."
      - "TOOL_CATALOGUE is still imported."
      - "No test body changed in this task."
      - "Import order is otherwise unchanged."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Delete the `installAllGlobal` test
    ```yaml
    description: "The only coverage of the removed function goes with it."
    author: Anthony Koukoullis
    issues: [ISS-43-xszeei]
    implement:
      - |
        src/test/unit/agentic-tools-install.test.ts
        <<<<<<< SEARCH
        });

        test('installAllGlobal runs across the real four-tool TOOL_CATALOGUE with no write ever reaching mcp-json', async () => {
          const fsWrite = fakeFsWriteAccess();
          const resolveGlobalBasePath = (tool: ToolDefinition) => `/home/fakeuser/.${tool.id}`;
          const getInstallContent: GetInstallContent = async () => twoSkillContent;

          const results = await installAllGlobal(TOOL_CATALOGUE, resolveGlobalBasePath, REGISTRY_PATH, {
            fsWrite,
            getInstallContent,
          });

          // One InstallResult per catalogue entry, in catalogue order.
          assert.equal(results.length, 4);
          assert.deepEqual(results.map((r) => r.toolId), TOOL_CATALOGUE.map((t) => t.id));

          // Claude Code, Cursor, Windsurf, and OpenCode all resolve to a real,
          // implemented format and install successfully. (installAllGlobal's
          // try/catch around each per-tool install remains defensive for any future
          // catalogue entry that resolves to an unimplemented format — it just isn't
          // exercised by any of these four tools today.)
          for (const toolId of ['claude-code', 'cursor', 'windsurf', 'opencode']) {
            const result = results.find((r) => r.toolId === toolId);
            assert.ok(result, `missing InstallResult for ${toolId}`);
            assert.equal(result!.status, 'installed', `expected ${toolId} to install`);
          }

          // No recorded write ever targets an mcp-json path — mcp-json is excluded
          // by selectPrimaryFormat and guarded independently inside formatForTarget,
          // so it should never be reachable from installAllGlobal for any tool.
          const writeCalls = contentWriteCalls(fsWrite);
          assert.ok(writeCalls.length > 0);
          for (const call of writeCalls) {
            assert.ok(!call.path.endsWith('.cursor/mcp.json'), `unexpected mcp-json write: ${call.path}`);
            assert.ok(!call.path.endsWith('mcp_config.json'), `unexpected mcp-json write: ${call.path}`);
          }
        });
        =======
        });
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-install.test.ts, the closing '});' of the preceding test, the blank line after it, and the final test."
    imports: "None."
    compatibility: "This test also asserted that all four tools install at global scope, which stopped being true at task 2.2 for both Cursor and Windsurf. Removing it with the function it covers resolves that too."
    gotcha: "The REPLACE side is the preceding test's closing '});' alone. The SEARCH starts on that line so the blank line before the deleted test goes with it, and the file ends with '});' and one newline rather than a trailing blank line."
    verify:
      - "grep -c 'installAllGlobal' src/test/unit/agentic-tools-install.test.ts — returns 4 before this task; must return 0 after it."
      - "grep -rn 'installAllGlobal' src — returns 6 lines at f0b0a8c; must return no lines after this task."
      - "npx tsc --noEmit -p tsconfig.json — must pass."
    checklist:
      - "installAllGlobal appears nowhere under src/."
      - "The nine remaining tests in the file are intact."
      - "The type-check passes."
      - "The file ends with a newline."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Record every path an install writes (ISS-35-m54y06)

  ```yaml
  description: "InstallRecord gains an optional resolvedPaths array beside the existing single resolvedPath, installToTarget fills it, removeInstallation deletes every path in it instead of only the first, and the HTTP remove route validates every path in it before it lets that deletion run."
  ```

  - [x] 4.1 Add `resolvedPaths` to `InstallRecord`
    ```yaml
    description: "Additive and optional, so a record already on disk in the single-path shape still reads back."
    author: Anthony Koukoullis
    issues: [ISS-35-m54y06]
    implement:
      - |
        src/lib/agentic-tools-install-tracking.ts
        <<<<<<< SEARCH
        export interface InstallRecord {
          toolId: string;
          resolvedPath: string;
          format: IntegrationFormat['kind'];
          scope: InstallScope;
          installedAt: string;
          updatedAt: string;
          contentHash: string;
          version?: string; // release tag as published; absent only for pre-feature install records
        }
        =======
        export interface InstallRecord {
          toolId: string;
          resolvedPath: string; // the FIRST path written; kept for readers written against the single-path shape
          // Every path the install wrote. Optional, because .praxis-installs.json
          // is a live on-disk format: a record written before this field existed
          // carries resolvedPath alone, and readers fall back to it rather than
          // treating the record as unreadable.
          resolvedPaths?: string[];
          format: IntegrationFormat['kind'];
          scope: InstallScope;
          installedAt: string;
          updatedAt: string;
          contentHash: string;
          version?: string; // release tag as published; absent only for pre-feature install records
        }
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install-tracking.ts, the InstallRecord interface only."
    imports: "None."
    compatibility: "Optional, so every existing record and every existing test fixture stays valid. The HTTP remove route's containment check reads record.resolvedPath, which is unchanged, so that route needs no edit in this task; task 4.5 widens its check to every recorded path once the engine deletes every recorded path."
    gotcha: "Do not remove resolvedPath. The route at src/http/routes-integrations.ts:370 and the Electron handler both read it, and dropping it would break both. It also stays the fallback recordedInstallPaths (task 4.3) answers for a record with no resolvedPaths."
    verify:
      - "grep -c 'resolvedPaths' src/lib/agentic-tools-install-tracking.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "npx tsc --noEmit -p tsconfig.json — must pass."
    checklist:
      - "resolvedPaths is optional."
      - "resolvedPath is still present and still required."
      - "The pure functions below the interface are unchanged."
      - "The type-check passes."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 Collect every written path and persist it
    ```yaml
    description: "The write loop keeps the whole set instead of discarding all but the first path."
    author: Anthony Koukoullis
    issues: [ISS-35-m54y06]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
          let resolvedPath: string | null = null;
          for (const write of writes) {
            const fullPath = `${target.basePath}/${write.relativePath}`;
            // Containment gate in front of the write: resolve both sides with the
            // host's own rules and compare on a separator boundary, so a sibling
            // directory whose name merely begins with the base's name is refused.
            const resolvedBase = path.resolve(target.basePath);
            const resolvedFull = path.resolve(fullPath);
            if (!resolvedFull.startsWith(resolvedBase + path.sep)) {
              throw new Error(`Refusing to write outside the install target: ${write.relativePath}`);
            }
            const dir = fullPath.replace(/\/[^/]+$/, '');
            await deps.fsWrite.mkdir(dir);
            await deps.fsWrite.writeTextFileAtomic(fullPath, write.content);
            if (resolvedPath === null) resolvedPath = fullPath;
          }

          const now = new Date().toISOString();
          const record: InstallRecord = {
            toolId: target.tool.id,
            resolvedPath: resolvedPath ?? '',
            format: format.kind,
            scope: target.scope,
            installedAt: existing?.installedAt ?? now,
            updatedAt: now,
            contentHash,
          };
        =======
          const writtenPaths: string[] = [];
          for (const write of writes) {
            const fullPath = `${target.basePath}/${write.relativePath}`;
            // Containment gate in front of the write: resolve both sides with the
            // host's own rules and compare on a separator boundary, so a sibling
            // directory whose name merely begins with the base's name is refused.
            const resolvedBase = path.resolve(target.basePath);
            const resolvedFull = path.resolve(fullPath);
            if (!resolvedFull.startsWith(resolvedBase + path.sep)) {
              throw new Error(`Refusing to write outside the install target: ${write.relativePath}`);
            }
            const dir = fullPath.replace(/\/[^/]+$/, '');
            await deps.fsWrite.mkdir(dir);
            await deps.fsWrite.writeTextFileAtomic(fullPath, write.content);
            writtenPaths.push(fullPath);
          }

          // One install of the canonical suite writes one SKILL.md per skill plus
          // one file per bundled reference file. Recording only the first of them
          // is what left removal deleting a fraction of the install.
          const resolvedPath = writtenPaths.length === 0 ? null : writtenPaths[0];
          const now = new Date().toISOString();
          const record: InstallRecord = {
            toolId: target.tool.id,
            resolvedPath: resolvedPath ?? '',
            resolvedPaths: writtenPaths,
            format: format.kind,
            scope: target.scope,
            installedAt: existing?.installedAt ?? now,
            updatedAt: now,
            contentHash,
          };
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, the write loop and the record literal inside installToTarget."
    imports: "None."
    compatibility: "resolvedPath keeps its meaning as the first written path, so the InstallResult returned at the end of the function, the HTTP remove route's containment check, and the browser InstallRecord mirror are all unaffected in shape."
    gotcha: "The `resolvedPath` binding becomes a const of type string | null, which is exactly what the unchanged return statement below the record needs. Task 10.1 later edits two lines inside this same loop, and quotes them as written here."
    verify:
      - "grep -c 'writtenPaths.push(fullPath);' src/lib/agentic-tools-install.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "npx tsc --noEmit -p tsconfig.json — must pass."
    checklist:
      - "Every written path is pushed to writtenPaths."
      - "The record carries both resolvedPath and resolvedPaths."
      - "resolvedPath is the first written path, or the empty string when nothing was written."
      - "The containment gate is unchanged."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.3 Delete every recorded path on removal
    ```yaml
    description: "removeInstallation loops over the recorded set through one shared reader that also handles a legacy single-path record."
    author: Anthony Koukoullis
    issues: [ISS-35-m54y06]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
        // Deletes the tracked file/directory at the record's resolvedPath (if any),
        // then removes the record and persists the registry. No-op (does not throw)
        // if no record exists for the (toolId, scope) pair, matching the port's
        // documented idempotent-remove contract.
        export async function removeInstallation(
          toolId: string,
          scope: InstallScope,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess },
        ): Promise<void> {
          const records = await readRegistry(registryPath, deps.fsWrite);
          const existing = findInstallRecord(records, toolId, scope);
          if (existing === undefined) return;

          await deps.fsWrite.remove(existing.resolvedPath);
          const nextRecords = removeInstallRecord(records, toolId, scope);
          await writeRegistry(registryPath, nextRecords, deps.fsWrite);
        }
        =======
        // Every path a record says its install wrote. A record written before
        // resolvedPaths existed carries the single resolvedPath alone, so it falls
        // back to that one path and keeps exactly the behaviour it had. Exported
        // because the HTTP remove route must validate exactly the list this
        // module deletes, never a list of its own derivation.
        export function recordedInstallPaths(record: InstallRecord): string[] {
          return record.resolvedPaths ?? [record.resolvedPath];
        }

        // Deletes every tracked file/directory the record says the install wrote,
        // then removes the record and persists the registry. No-op (does not throw)
        // if no record exists for the (toolId, scope) pair, matching the port's
        // documented idempotent-remove contract.
        export async function removeInstallation(
          toolId: string,
          scope: InstallScope,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess },
        ): Promise<void> {
          const records = await readRegistry(registryPath, deps.fsWrite);
          const existing = findInstallRecord(records, toolId, scope);
          if (existing === undefined) return;

          for (const target of recordedInstallPaths(existing)) {
            await deps.fsWrite.remove(target);
          }
          const nextRecords = removeInstallRecord(records, toolId, scope);
          await writeRegistry(registryPath, nextRecords, deps.fsWrite);
        }
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, the removeInstallation comment and function, plus the new helper above it."
    imports: "None. InstallRecord is already imported as a type."
    compatibility: "fsWrite.remove is recursive and force-enabled, so a path already gone is not an error. The deletes run in sequence, matching the sequential write loop."
    gotcha: "Task 5 calls recordedInstallPaths from installToTarget, which sits above this point in the file. A function declaration hoists, so that is fine — do not convert it to a const arrow. The helper is exported on purpose: task 4.5 imports it into src/http/routes-integrations.ts so the route checks the same list the engine deletes. It is pure path bookkeeping and carries no status code, so the hexagonal split holds."
    verify:
      - "grep -c 'recordedInstallPaths' src/lib/agentic-tools-install.ts — returns 0 at f0b0a8c (exit 1); returns 2 after this task."
      - |
        npm run build && node --input-type=module -e "
        import { installToTarget, removeInstallation } from './dist/lib/agentic-tools-install.js';
        import { TOOL_CATALOGUE } from './dist/lib/agentic-tools-catalogue.js';
        const files=new Map(); const removes=[];
        const fsWrite={async readTextFile(p){return files.has(p)?files.get(p):null;},async writeTextFileAtomic(p,c){files.set(p,c);},async readBinaryFile(){return null;},async writeBinaryFileAtomic(){},async mkdir(){},async remove(p){removes.push(p);},async expandTokens(p){return p;}};
        const tool=TOOL_CATALOGUE.find(t=>t.id==='claude-code');
        const mk=(b)=>({version:'1',skills:[{id:'a',name:'A',description:'',body:b,files:[{relativePath:'r.md',content:'y'}]},{id:'b',name:'B',description:'',body:'z'}]});
        await installToTarget({tool,basePath:'/tmp/fakebase',scope:{kind:'global'}},mk('x'),'/tmp/fakebase/reg.json',{fsWrite});
        await installToTarget({tool,basePath:'/tmp/fakebase',scope:{kind:'global'}},mk('x2'),'/tmp/fakebase/reg.json',{fsWrite});
        console.log('removes after update:',removes.length);
        await removeInstallation('claude-code',{kind:'global'},'/tmp/fakebase/reg.json',{fsWrite});
        console.log('removes total:',removes.length,JSON.stringify(removes));
        "
        At f0b0a8c this prints 'removes after update: 0' and 'removes total: 1' with one path.
        After this task it must print 'removes after update: 0' (task 5 changes that line) and
        'removes total: 3', listing skills/a/SKILL.md, skills/a/r.md and skills/b/SKILL.md.
    checklist:
      - "removeInstallation deletes every path recordedInstallPaths returns."
      - "recordedInstallPaths falls back to resolvedPath when resolvedPaths is absent, and is exported."
      - "The no-record early return still makes zero remove calls."
      - "The probe reports 'removes total: 3'."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.4 Mirror the new field on the browser side
    ```yaml
    description: "src/public/lib/agentic-tools-api.ts mirrors InstallRecord by hand, so the shape must move with it."
    author: Anthony Koukoullis
    issues: [ISS-35-m54y06]
    implement:
      - |
        src/public/lib/agentic-tools-api.ts
        <<<<<<< SEARCH
        export interface InstallRecord {
          toolId: string;
          resolvedPath: string;
          format: string;
          scope: InstallScope;
          installedAt: string;
          updatedAt: string;
          contentHash: string;
          version?: string;
        }
        =======
        export interface InstallRecord {
          toolId: string;
          resolvedPath: string;
          resolvedPaths?: string[];
          format: string;
          scope: InstallScope;
          installedAt: string;
          updatedAt: string;
          contentHash: string;
          version?: string;
        }
        >>>>>>> REPLACE
    pattern: "src/public/lib/agentic-tools-api.ts, the InstallRecord mirror only."
    imports: "None. The file stays free of Node types."
    compatibility: "This file compiles under src/public/tsconfig.json with \"types\": []. A plain string[] uses no Node global."
    gotcha: "This is a mirror, not an import. Do not import the src/lib type here."
    verify:
      - "grep -c 'resolvedPaths' src/public/lib/agentic-tools-api.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "npx tsc --noEmit -p src/public/tsconfig.json — must pass."
    checklist:
      - "The mirrored field is optional, matching the src/lib shape."
      - "No import was added to this file."
      - "The browser type-check passes."
      - "No other interface in the file changed."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.5 Validate every recorded path in the HTTP remove route
    ```yaml
    description: "Task 4.3 makes removeInstallation delete every path recordedInstallPaths answers, but the remove route still checked record.resolvedPath alone before calling it. A ledger that is corrupt, hand-edited or tampered with, whose first path sits inside the permitted root and whose second does not, passed that check and had the second path deleted recursively. The route now applies the unchanged rule to every path in that same list and refuses the whole request with 400 before anything is deleted."
    author: Anthony Koukoullis
    issues: [ISS-35-m54y06]
    implement:
      - |
        src/http/routes-integrations.ts
        <<<<<<< SEARCH
        import { installToTarget, removeInstallation } from '../lib/agentic-tools-install.js';
        =======
        import { installToTarget, removeInstallation, recordedInstallPaths } from '../lib/agentic-tools-install.js';
        >>>>>>> REPLACE
      - |
        src/http/routes-integrations.ts
        <<<<<<< SEARCH
        // POST /api/integrations/installs/remove — mirrors the removeInstallation IPC
        // channel (electron/agentic-tools-ipc-handlers.cts:421-457). The engine's
        // removeInstallation deletes the record's resolvedPath recursively, so the
        // boundary check runs first, against a root this process derived rather than
        // one the client supplied. The 200 body is the literal null, because the shim's
        // fetchIpc assigns the parsed body straight to `data`.
        =======
        // POST /api/integrations/installs/remove — mirrors the removeInstallation IPC
        // channel (electron/agentic-tools-ipc-handlers.cts:421-457). The engine's
        // removeInstallation deletes EVERY path recordedInstallPaths answers for the
        // record, recursively, so the boundary check runs first over that same list,
        // against a root this process derived rather than one the client supplied,
        // and the whole request is refused before anything is deleted. The 200 body
        // is the literal null, because the shim's fetchIpc assigns the parsed body
        // straight to `data`.
        >>>>>>> REPLACE
      - |
        src/http/routes-integrations.ts
        <<<<<<< SEARCH
              const detections = scope.kind === 'global' ? await detectionsForPermittedRoots(deps) : [];
              const permittedRoot = permittedRootFor(toolId, scope, detections, deps.registry);
              const resolvedTarget = path.resolve(record.resolvedPath);
              // The trailing path.sep is what makes this a boundary rather than a bare
              // prefix: without it a sibling whose name merely begins with the root's
              // name would pass. Equality with the root is refused too — a tracked
              // install is always a path under its base, never the base.
              if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
                sendJson(res, 400, {
                  error: `Refused remove path outside the permitted root for ${toolId}: ${record.resolvedPath}`,
                });
                return;
              }
              await removeInstallation(toolId, scope, deps.installRegistryPath, { fsWrite: deps.fsWrite });
        =======
              const detections = scope.kind === 'global' ? await detectionsForPermittedRoots(deps) : [];
              const permittedRoot = permittedRootFor(toolId, scope, detections, deps.registry);
              // The list checked here is the list the engine deletes, read through
              // the same recordedInstallPaths the engine reads, so a ledger that is
              // corrupt, hand-edited or tampered with cannot pass one path inside
              // the root and have a second one outside it deleted. Every path is
              // checked before any is removed, and one failure refuses the whole
              // request.
              for (const recorded of recordedInstallPaths(record)) {
                const resolvedTarget = path.resolve(recorded);
                // The trailing path.sep is what makes this a boundary rather than a bare
                // prefix: without it a sibling whose name merely begins with the root's
                // name would pass. Equality with the root is refused too — a tracked
                // install is always a path under its base, never the base.
                if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
                  sendJson(res, 400, {
                    error: `Refused remove path outside the permitted root for ${toolId}: ${recorded}`,
                  });
                  return;
                }
              }
              await removeInstallation(toolId, scope, deps.installRegistryPath, { fsWrite: deps.fsWrite });
        >>>>>>> REPLACE
    pattern: "src/http/routes-integrations.ts, the install-engine import line, the comment above handleIntegrationsInstallRemove, and the permitted-root check inside it. Three blocks, one file."
    imports: "recordedInstallPaths, exported by task 4.3 from src/lib/agentic-tools-install.ts. Apply tasks 4.1 and 4.3 first. No new module and no runtime dependency."
    compatibility: "No earlier task edits this file, so every SEARCH here is the f0b0a8c text. The rule per path is unchanged from f0b0a8c: resolve it, require it strictly inside the permitted root on a separator boundary, and refuse equality with the root. Only the set of paths it runs over changes, and that set comes from the one helper removeInstallation itself reads, so the route can never check a shorter list than the engine deletes. A ledger this app wrote still passes, because every path in it passed the write-time containment gate in installToTarget. The 400 message keeps its shape and names the first path that failed. The validation stays in src/http; no status code moves into src/lib. Task 6 later wraps this loop so a record naming no non-empty path skips it, and quotes the text as written here."
    gotcha: "Do not rebuild the list in the route from record.resolvedPaths or record.resolvedPath. If the route derives its own list, the route and the engine can disagree about what is deleted, which is the gap this task closes. Keep the permittedRoot === null test inside the loop condition as at f0b0a8c: before task 6, the list is never empty, and after task 6 an empty list is handled by that task's wrapper rather than by a separate null check here."
    verify:
      - "grep -c 'const resolvedTarget = path.resolve(recorded);' src/http/routes-integrations.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task, and still 1 after task 6 rewrites the loop around it."
      - "grep -c 'path.resolve(record.resolvedPath)' src/http/routes-integrations.ts — returns 1 at f0b0a8c; must return 0 after this task (exit 1), and stays 0 to the end of the list."
      - "npx tsc --noEmit -p tsconfig.json — must pass."
      - |
        npm run build && node --input-type=module -e "
        import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path'; import { Readable } from 'node:stream';
        import { handleIntegrationsRoutes } from './dist/http/routes-integrations.js';
        import { createNodeFsWriteAccess, createNodeFsAccess } from './dist/lib/agentic-tools-fs-adapter.js';
        const root=await fs.mkdtemp(path.join(os.tmpdir(),'fc-iss35-')); const project=path.join(root,'project'); const reg=path.join(root,'reg.json');
        const inside=path.join(project,'.claude','skills','a','SKILL.md'); const outside=path.join(root,'victim','keep.md');
        for (const f of [inside,outside]) { await fs.mkdir(path.dirname(f),{recursive:true}); await fs.writeFile(f,'x'); }
        await fs.writeFile(reg,JSON.stringify([{toolId:'claude-code',resolvedPath:inside,resolvedPaths:[inside,outside],format:'skill-directory',scope:{kind:'project',projectPath:project},installedAt:'a',updatedAt:'b',contentHash:'c'}]));
        const req=Readable.from([Buffer.from(JSON.stringify({toolId:'claude-code',scope:{kind:'project',projectPath:project}}))]); req.headers={}; req.socket={remoteAddress:'127.0.0.1'};
        let status=200, body=''; const res={setHeader(){},writeHead(s){status=s;},end(c){body+=c??'';},on(){}};
        handleIntegrationsRoutes(req,res,'/api/integrations/installs/remove','POST',{registry:{list:()=>[{id:'p',name:'p',path:project}]},installRegistryPath:reg,fsWrite:createNodeFsWriteAccess(),createFsAccess:createNodeFsAccess});
        await new Promise(r=>setTimeout(r,500));
        const has=async(p)=>{try{await fs.access(p);return 'present';}catch{return 'gone';}};
        console.log(status, body.startsWith('{\"error\":\"Refused remove path outside the permitted root for claude-code: ')?'refused':body, 'inside', await has(inside), 'outside', await has(outside), 'records', JSON.parse(await fs.readFile(reg,'utf8')).length); await fs.rm(root,{recursive:true,force:true});
        "
        Drives the compiled remove route in-process against a scratch ledger under os.tmpdir(),
        at project scope with the scratch project registered so the permitted root is that
        project. The record's first path is inside the root; its second is a sibling
        directory outside it. At f0b0a8c this prints '200 null inside gone outside present
        records 0', because the engine then deleted only resolvedPath. After task 4.4 and
        before this task it prints '200 null inside gone outside gone records 0': the route
        checked one path and the engine deleted both, including the one outside the root.
        After this task it must print: 400 refused inside present outside present records 1
      - |
        Re-run the probe above with the record's second path inside the root: replace the
        line that assigns `outside` with
        const outside=path.join(project,'.claude','skills','b','SKILL.md');
        A legitimate multi-path record still removes cleanly. At f0b0a8c it prints '200 null
        inside gone outside present records 0' (one path deleted). After task 4.4 and after
        this task alike it must print: 200 null inside gone outside gone records 0
    checklist:
      - "The route imports recordedInstallPaths and reads the record's paths through it, nowhere else."
      - "Every recorded path is resolved and checked on a separator boundary against the permitted root, and equality with the root is refused."
      - "One failing path refuses the whole request with 400 before removeInstallation is called."
      - "The outside-path probe answers 400 with both files present and the record still in the ledger."
      - "The inside-path probe answers 200 with both files gone and an empty ledger."
      - "No status code or HTTP concern was added to src/lib."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Delete the previous install before writing an update (ISS-36-vl2cpx)

  ```yaml
  description: "installToTarget removes every path the previous record wrote before it writes the new set, so a renamed suite cannot leave two generations on disk."
  author: Anthony Koukoullis
  issues: [ISS-36-vl2cpx]
  implement:
    - |
      src/lib/agentic-tools-install.ts
      <<<<<<< SEARCH
        const writes = formatForTarget(format, content);
      =======
        // An update REPLACES the previous install rather than layering on top of
        // it. Without this, a machine carrying the pre-rename prx-* suite keeps
        // all eight of those directories alongside the eight fc-* ones, and the
        // tool loads two generations of the same skills. Reached only when a
        // record exists and its contentHash did not match, because the matching
        // branch above returns early.
        if (existing !== undefined) {
          for (const stale of recordedInstallPaths(existing)) {
            await deps.fsWrite.remove(stale);
          }
        }

        const writes = formatForTarget(format, content);
      >>>>>>> REPLACE
  pattern: "src/lib/agentic-tools-install.ts, one line inside installToTarget, immediately after the up-to-date early return."
  imports: "None. recordedInstallPaths is the module-local helper task 4.3 added."
  compatibility: "Depends on task 4.3. Apply that task first — this block calls the helper it defines, and quotes a line task 4.2 did not touch."
  gotcha: "The removal runs before the new writes, so a failure mid-update leaves the target empty rather than mixed. That is the same exposure the existing write loop already has, and the registry record is still written only after the writes succeed."
  verify:
    - "grep -c 'for (const stale of recordedInstallPaths(existing))' src/lib/agentic-tools-install.ts — returns 0 before this task (exit 1); returns 1 after it."
    - "Re-run the probe from task 4.3. At f0b0a8c it prints 'removes after update: 0'. After this task it must print 'removes after update: 3' and 'removes total: 6'."
    - "npx tsc --noEmit -p tsconfig.json — must pass."
  checklist:
    - "The cleanup runs only when a previous record exists."
    - "The cleanup runs before formatForTarget and before any new write."
    - "The up-to-date early return above still makes zero remove calls."
    - "The probe reports 'removes after update: 3'."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 6. Treat a record with no recorded path as nothing to delete (ISS-44-mm57nt)

  ```yaml
  description: "An install that wrote nothing records an empty resolvedPath, and a legacy record can hold one too. The engine hands that empty string to fsWrite.remove, and the HTTP remove route runs path.resolve('') on it, which is the server's working directory, so the permitted-root check answers 400 and the record can never be removed through the app. Filter empty entries in the one place the engine reads recorded paths, and let the route skip the containment check for a record that names nothing on disk."
  author: Anthony Koukoullis
  issues: [ISS-44-mm57nt]
  implement:
    - |
      src/lib/agentic-tools-install.ts
      <<<<<<< SEARCH
      // Every path a record says its install wrote. A record written before
      // resolvedPaths existed carries the single resolvedPath alone, so it falls
      // back to that one path and keeps exactly the behaviour it had. Exported
      // because the HTTP remove route must validate exactly the list this
      // module deletes, never a list of its own derivation.
      export function recordedInstallPaths(record: InstallRecord): string[] {
        return record.resolvedPaths ?? [record.resolvedPath];
      }
      =======
      // Every path a record says its install wrote. A record written before
      // resolvedPaths existed carries the single resolvedPath alone, so it falls
      // back to that one path and keeps exactly the behaviour it had. Exported
      // because the HTTP remove route must validate exactly the list this
      // module deletes, never a list of its own derivation. Empty entries are
      // dropped: an install that produced no writes stores an empty
      // resolvedPath, and nothing on disk answers to it, so neither removal nor
      // the update cleanup should hand '' to fsWrite.remove at all.
      export function recordedInstallPaths(record: InstallRecord): string[] {
        return (record.resolvedPaths ?? [record.resolvedPath]).filter((p) => p !== '');
      }
      >>>>>>> REPLACE
    - |
      src/http/routes-integrations.ts
      <<<<<<< SEARCH
            const detections = scope.kind === 'global' ? await detectionsForPermittedRoots(deps) : [];
            const permittedRoot = permittedRootFor(toolId, scope, detections, deps.registry);
            // The list checked here is the list the engine deletes, read through
            // the same recordedInstallPaths the engine reads, so a ledger that is
            // corrupt, hand-edited or tampered with cannot pass one path inside
            // the root and have a second one outside it deleted. Every path is
            // checked before any is removed, and one failure refuses the whole
            // request.
            for (const recorded of recordedInstallPaths(record)) {
              const resolvedTarget = path.resolve(recorded);
              // The trailing path.sep is what makes this a boundary rather than a bare
              // prefix: without it a sibling whose name merely begins with the root's
              // name would pass. Equality with the root is refused too — a tracked
              // install is always a path under its base, never the base.
              if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
                sendJson(res, 400, {
                  error: `Refused remove path outside the permitted root for ${toolId}: ${recorded}`,
                });
                return;
              }
            }
            await removeInstallation(toolId, scope, deps.installRegistryPath, { fsWrite: deps.fsWrite });
      =======
            // An install that wrote nothing recorded an empty resolvedPath, and
            // path.resolve('') is this process's working directory, which never
            // sits under the permitted root: the check below then refused the one
            // request that could drop that record. recordedInstallPaths now drops
            // empty entries, so a record naming no non-empty path answers an
            // empty list here, has nothing on disk to contain, and goes straight
            // to removeInstallation, which deletes nothing and drops the record.
            const recordedPaths = recordedInstallPaths(record);
            if (recordedPaths.length > 0) {
              const detections = scope.kind === 'global' ? await detectionsForPermittedRoots(deps) : [];
              const permittedRoot = permittedRootFor(toolId, scope, detections, deps.registry);
              // The list checked here is the list the engine deletes, read through
              // the same recordedInstallPaths the engine reads, so a ledger that is
              // corrupt, hand-edited or tampered with cannot pass one path inside
              // the root and have a second one outside it deleted. Every path is
              // checked before any is removed, and one failure refuses the whole
              // request.
              for (const recorded of recordedPaths) {
                const resolvedTarget = path.resolve(recorded);
                // The trailing path.sep is what makes this a boundary rather than a bare
                // prefix: without it a sibling whose name merely begins with the root's
                // name would pass. Equality with the root is refused too — a tracked
                // install is always a path under its base, never the base.
                if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
                  sendJson(res, 400, {
                    error: `Refused remove path outside the permitted root for ${toolId}: ${recorded}`,
                  });
                  return;
                }
              }
            }
            await removeInstallation(toolId, scope, deps.installRegistryPath, { fsWrite: deps.fsWrite });
      >>>>>>> REPLACE
  pattern: "src/lib/agentic-tools-install.ts, the recordedInstallPaths helper only; src/http/routes-integrations.ts, the permitted-root check inside handleIntegrationsInstallRemove only."
  imports: "None. The route already imports node:path, and task 4.5 already imports recordedInstallPaths into it."
  compatibility: "Depends on task 4.3, which created the helper, on task 4.1, which added resolvedPaths, and on task 4.5, which made the route read its paths through the helper. Apply all three first. The engine filter covers every reader at once — removeInstallation, the update cleanup task 5 added, and the route's containment loop from task 4.5, which is why the route needs no filter of its own. The route change is confined to the one branch where no recorded path is non-empty; a record with any real path still passes through task 4.5's per-path containment loop unchanged. Task 4.5 rewrote this region, so the SEARCH quotes the file as it stands after that task, not the f0b0a8c text."
  gotcha: "Filter for the empty string only. Do not add trimming or any other path validation; the containment gate in the write loop already governs what may be written. In the route, keep reading the list through recordedInstallPaths rather than record.resolvedPath: the route must check exactly the list the engine deletes, which is the guard task 4.5 installed. A hand-edited record with an empty resolvedPath and a non-empty resolvedPaths is therefore judged on the resolvedPaths the engine would remove, every one of which must sit inside the permitted root."
  verify:
    - "grep -c \"filter((p) => p !== '')\" src/lib/agentic-tools-install.ts — returns 0 before this task (exit 1); returns 1 after it."
    - "grep -c 'if (recordedPaths.length > 0) {' src/http/routes-integrations.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    - |
      npm run build && node --input-type=module -e "
      import { installToTarget, removeInstallation } from './dist/lib/agentic-tools-install.js';
      import { TOOL_CATALOGUE } from './dist/lib/agentic-tools-catalogue.js';
      const files=new Map(); const removes=[];
      const fsWrite={async readTextFile(p){return files.has(p)?files.get(p):null;},async writeTextFileAtomic(p,c){files.set(p,c);},async readBinaryFile(){return null;},async writeBinaryFileAtomic(){},async mkdir(){},async remove(p){removes.push(p);},async expandTokens(p){return p;}};
      const tool=TOOL_CATALOGUE.find(t=>t.id==='claude-code');
      await installToTarget({tool,basePath:'/tmp/fakebase',scope:{kind:'global'}},{version:'1',skills:[]},'/tmp/fakebase/reg.json',{fsWrite});
      await removeInstallation('claude-code',{kind:'global'},'/tmp/fakebase/reg.json',{fsWrite});
      console.log('remove calls:',JSON.stringify(removes));
      "
      At f0b0a8c this prints: remove calls: [""]. After this task it must print: remove calls: [].
    - |
      npm run build && node --input-type=module -e "
      import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path'; import { Readable } from 'node:stream';
      import { handleIntegrationsRoutes } from './dist/http/routes-integrations.js';
      import { createNodeFsWriteAccess, createNodeFsAccess } from './dist/lib/agentic-tools-fs-adapter.js';
      const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fc-iss44-')); const reg=path.join(dir,'reg.json');
      await fs.writeFile(reg,JSON.stringify([{toolId:'claude-code',resolvedPath:'',format:'skill-directory',scope:{kind:'project',projectPath:dir},installedAt:'a',updatedAt:'b',contentHash:'c'}]));
      const req=Readable.from([Buffer.from(JSON.stringify({toolId:'claude-code',scope:{kind:'project',projectPath:dir}}))]); req.headers={}; req.socket={remoteAddress:'127.0.0.1'};
      let status=200, body=''; const res={setHeader(){},writeHead(s){status=s;},end(c){body+=c??'';},on(){}};
      handleIntegrationsRoutes(req,res,'/api/integrations/installs/remove','POST',{registry:{list:()=>[]},installRegistryPath:reg,fsWrite:createNodeFsWriteAccess(),createFsAccess:createNodeFsAccess});
      await new Promise(r=>setTimeout(r,500));
      console.log(status, body, await fs.readFile(reg,'utf8')); await fs.rm(dir,{recursive:true,force:true});
      "
      Drives the compiled remove route in-process against a scratch ledger under os.tmpdir()
      holding one record with an empty resolvedPath, at project scope so no tool detection
      runs. At f0b0a8c this prints status 400 with 'Refused remove path outside the permitted
      root for claude-code: ' and the record still in the ledger. After this task it must print
      status 200, the body null, and an empty ledger: 200 null []
  checklist:
    - "The helper filters out empty strings."
    - "A record with a real path still returns that path, and still passes through the route's containment check."
    - "The empty-skills probe reports an empty remove list."
    - "The route probe answers 200 and leaves an empty ledger."
    - "No other function changed."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 7. Correct the two tests that assert the defects as correct (ISS-37-niiof1)

  ```yaml
  description: "One test asserts the doubled Cursor global path, the other asserts that removal makes exactly one remove call. Both now assert the corrected behaviour."
  ```

  - [x] 7.1 Assert the Cursor paths the tool actually reads
    ```yaml
    description: "Cursor's rules format is project-scoped, so the test installs at project scope and asserts that global scope resolves to no format."
    author: Anthony Koukoullis
    issues: [ISS-37-niiof1]
    implement:
      - |
        src/test/unit/agentic-tools-install.test.ts
        <<<<<<< SEARCH
        test('installToTarget writes exactly the expected rule-directory files for Cursor at global scope', async () => {
          const fsWrite = fakeFsWriteAccess();
          const target: InstallTarget = { tool: cursor(), basePath: '/home/fakeuser/.cursor', scope: { kind: 'global' } };

          const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

          assert.equal(result.status, 'installed');
          assert.equal(result.toolId, 'cursor');
          // Cursor's real catalogue rule-directory format resolves to a rules entry,
          // never the mcp-json entry that sits alongside it.
          assert.equal(result.resolvedPath, '/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc');

          const writeCalls = contentWriteCalls(fsWrite);
          assert.deepEqual(
            writeCalls.map((c) => c.path),
            [
              '/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc',
              '/home/fakeuser/.cursor/.cursor/rules/prx-beta.mdc',
            ],
          );
          assert.equal(writeCalls[0]?.content, 'alpha body');
          assert.equal(writeCalls[1]?.content, 'beta body');
        });
        =======
        test('installToTarget writes exactly the expected rule-directory files for Cursor at project scope', async () => {
          const fsWrite = fakeFsWriteAccess();
          const target: InstallTarget = {
            tool: cursor(),
            basePath: '/home/fakeuser/repo',
            scope: { kind: 'project', projectPath: '/home/fakeuser/repo' },
          };

          const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

          assert.equal(result.status, 'installed');
          assert.equal(result.toolId, 'cursor');
          // The path Cursor actually reads: .cursor/rules/*.mdc under a PROJECT
          // root, never that template appended to the ~/.cursor configDir.
          assert.equal(result.resolvedPath, '/home/fakeuser/repo/.cursor/rules/prx-alpha.mdc');

          const writeCalls = contentWriteCalls(fsWrite);
          assert.deepEqual(
            writeCalls.map((c) => c.path),
            [
              '/home/fakeuser/repo/.cursor/rules/prx-alpha.mdc',
              '/home/fakeuser/repo/.cursor/rules/prx-beta.mdc',
            ],
          );
          assert.equal(writeCalls[0]?.content, 'alpha body');
          assert.equal(writeCalls[1]?.content, 'beta body');
        });

        test('installToTarget writes nothing for Cursor at global scope, because Cursor reads no user-level rules directory', async () => {
          const fsWrite = fakeFsWriteAccess();
          const target: InstallTarget = { tool: cursor(), basePath: '/home/fakeuser/.cursor', scope: { kind: 'global' } };

          const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

          assert.equal(result.status, 'skipped-no-format');
          assert.equal(result.resolvedPath, null);
          assert.equal(contentWriteCalls(fsWrite).length, 0);
        });
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-install.test.ts, the Cursor rule-directory test."
    imports: "None."
    compatibility: "Depends on tasks 1 and 2. Before those land, Cursor at project scope has no scopes field to select on."
    gotcha: "The install target's basePath must equal the project path at project scope; the containment gate resolves both and compares on a separator boundary."
    verify:
      - "grep -c \"'/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc'\" src/test/unit/agentic-tools-install.test.ts — returns 2 at f0b0a8c; must return 0 after this task."
    checklist:
      - "No assertion in the file names the doubled .cursor/.cursor path."
      - "The project-scope test asserts paths under the project root."
      - "A second test asserts skipped-no-format at global scope with zero content writes."
      - "The skill-directory Claude Code test above is untouched."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 7.2 Assert that removal deletes every path the install wrote
    ```yaml
    description: "The remove test asserted exactly one remove call, which is the defect. It now asserts the full set."
    author: Anthony Koukoullis
    issues: [ISS-37-niiof1]
    implement:
      - |
        src/test/unit/agentic-tools-install.test.ts
        <<<<<<< SEARCH
        test('removeInstallation deletes the tracked file and the record for that (toolId, scope) pair (acceptance criterion 6)', async () => {
          const fsWrite = fakeFsWriteAccess();
          const target: InstallTarget = { tool: claudeCode(), basePath: '/home/fakeuser/.claude', scope: { kind: 'global' } };

          const installed = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });
          assert.ok(installed.resolvedPath);

          await removeInstallation('claude-code', { kind: 'global' }, REGISTRY_PATH, { fsWrite });

          const removeCalls = fsWrite.calls.filter((c) => c.fn === 'remove');
          assert.deepEqual(removeCalls.map((c) => c.path), [installed.resolvedPath]);
        =======
        test('removeInstallation deletes every file the install wrote and the record for that (toolId, scope) pair (acceptance criterion 6)', async () => {
          const fsWrite = fakeFsWriteAccess();
          const target: InstallTarget = { tool: claudeCode(), basePath: '/home/fakeuser/.claude', scope: { kind: 'global' } };

          const installed = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });
          assert.ok(installed.resolvedPath);

          await removeInstallation('claude-code', { kind: 'global' }, REGISTRY_PATH, { fsWrite });

          // twoSkillContent writes three files — one SKILL.md per skill plus
          // prx-alpha's bundled reference file — so removal must delete three,
          // not just the first one the record used to carry.
          const removeCalls = fsWrite.calls.filter((c) => c.fn === 'remove');
          assert.deepEqual(removeCalls.map((c) => c.path), [
            '/home/fakeuser/.claude/skills/prx-alpha/SKILL.md',
            '/home/fakeuser/.claude/skills/prx-alpha/reference.md',
            '/home/fakeuser/.claude/skills/prx-beta/SKILL.md',
          ]);
        >>>>>>> REPLACE
    pattern: "src/test/unit/agentic-tools-install.test.ts, the first half of the removeInstallation test."
    imports: "None."
    compatibility: "The rest of that test, which asserts the record is gone from the registry, is below the SEARCH region and is untouched."
    gotcha: "The three paths and their order come from skillDirectoryWrites, which emits each skill's SKILL.md then its files[] entries, in content order."
    verify:
      - "grep -c \"\\[installed.resolvedPath\\]\" src/test/unit/agentic-tools-install.test.ts — returns 1 at f0b0a8c, the single-path assertion this task replaces; must return 0 after this task (exit 1)."
      - "npm run build && node --test dist/test/unit/agentic-tools-format.test.js dist/test/unit/agentic-tools-install-tracking.test.js dist/test/unit/agentic-tools-skill-presence.test.js — must report 0 fail."
      - "npm run build && node --test dist/test/unit/agentic-tools-install.test.js — the suite this task edits, rebuilt from the changed source. 10 of 10 pass at f0b0a8c and it must still report 0 fail. A regression guard, not a discriminating step; the grep above carries the discrimination."
    checklist:
      - "The remove assertion lists three paths."
      - "The registry assertion at the end of the test still runs."
      - "The whole agentic-tools install suite passes."
      - "No source file was changed to make a test pass."
    self_eval:
      passed: true
      failures: []
    ```

- [ ] 8. Validate the registry shape the comment already promises (ISS-40-798x06)

  ```yaml
  description: "parseInstallRegistry documents a wrong-shape rejection it never performs, so a hand-edited or crash-truncated record reaches path.resolve and throws. Add the check the comment describes."
  author: Anthony Koukoullis
  issues: [ISS-40-798x06]
  implement:
    - |
      src/lib/agentic-tools-install-tracking.ts
      <<<<<<< SEARCH
      // Returns [] on any parse failure (malformed JSON, wrong shape), matching
      // src/lib/projects.ts's readProjects own corrupted-file-returns-empty-list
      // posture rather than throwing.
      export function parseInstallRegistry(raw: string): InstallRecord[] {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) ? (parsed as InstallRecord[]) : [];
        } catch {
          return [];
        }
      }
      =======
      // The shape check the comment below promises. Plain TypeScript and no
      // schema library, because this project ships zero runtime dependencies.
      // `format` is checked as a string rather than against the kind union: that
      // union lives in agentic-tools-catalogue.ts and restating its members here
      // would be a second copy to keep in step.
      function isInstallRecordShape(value: unknown): value is InstallRecord {
        if (typeof value !== 'object' || value === null) return false;
        const record = value as Record<string, unknown>;
        const requiredStrings = ['toolId', 'resolvedPath', 'format', 'installedAt', 'updatedAt', 'contentHash'];
        if (!requiredStrings.every((key) => typeof record[key] === 'string')) return false;
        if (record.version !== undefined && typeof record.version !== 'string') return false;
        if (record.resolvedPaths !== undefined
          && !(Array.isArray(record.resolvedPaths) && record.resolvedPaths.every((p) => typeof p === 'string'))) {
          return false;
        }
        const scope = record.scope;
        if (typeof scope !== 'object' || scope === null) return false;
        const kind = (scope as Record<string, unknown>).kind;
        if (kind === 'global') return true;
        return kind === 'project' && typeof (scope as Record<string, unknown>).projectPath === 'string';
      }

      // Returns [] on any parse failure (malformed JSON, wrong shape), matching
      // src/lib/projects.ts's readProjects own corrupted-file-returns-empty-list
      // posture rather than throwing.
      export function parseInstallRegistry(raw: string): InstallRecord[] {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return [];
          return parsed.every(isInstallRecordShape) ? (parsed as InstallRecord[]) : [];
        } catch {
          return [];
        }
      }
      >>>>>>> REPLACE
  pattern: "src/lib/agentic-tools-install-tracking.ts, parseInstallRegistry and the new predicate above it."
  imports: "None. This module keeps its single type-only import of IntegrationFormat."
  compatibility: "Depends on task 4.1, which added resolvedPaths. A record in the pre-resolvedPaths shape still passes, because resolvedPaths is optional. Whole-file rejection, not per-record filtering, is what the existing comment documents."
  gotcha: "The round-trip test in src/test/unit/agentic-tools-install-tracking.test.ts builds records with every required field and a valid scope, so it must keep passing unchanged. If it fails, the predicate is wrong, not the test."
  verify:
    - |
      npm run build && node --input-type=module -e "
      import { parseInstallRegistry } from './dist/lib/agentic-tools-install-tracking.js';
      console.log(JSON.stringify(parseInstallRegistry('[{\"toolId\":\"cursor\",\"scope\":{\"kind\":\"global\"}}]')));
      "
      At f0b0a8c this prints the malformed record back verbatim:
      [{"toolId":"cursor","scope":{"kind":"global"}}]. After this task it must print [].
    - "npm run build && node --test dist/test/unit/agentic-tools-install-tracking.test.js — 6 of 6 pass at f0b0a8c and must still report 0 fail."
  checklist:
    - "A record missing resolvedPath makes parseInstallRegistry return []."
    - "A complete record without resolvedPaths still parses."
    - "A complete record with a string[] resolvedPaths still parses."
    - "No schema library or other runtime dependency was added."
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 9. Serialize the registry read-modify-write and make the temp file unique (ISS-41-qbdzgt)

  ```yaml
  description: "Two overlapping installs both read the registry, both compute a next state from their own stale copy, and one tool's record is lost. Their atomic writes also share one temp filename."
  ```

  - [ ] 9.1 Import a unique-suffix source in the filesystem adapter
    ```yaml
    description: "node:crypto is a built-in, so randomUUID adds no dependency."
    author: Anthony Koukoullis
    issues: [ISS-41-qbdzgt]
    implement:
      - |
        src/lib/agentic-tools-fs-adapter.ts
        <<<<<<< SEARCH
        import fs from 'node:fs/promises';
        import os from 'node:os';
        import path from 'node:path';
        =======
        import { randomUUID } from 'node:crypto';
        import fs from 'node:fs/promises';
        import os from 'node:os';
        import path from 'node:path';
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-fs-adapter.ts, the import block."
    imports: "node:crypto, a Node built-in. The zero-runtime-dependency rule is unaffected."
    compatibility: "This is Node-side adapter code, never bundled for the browser."
    gotcha: "Keep the built-in imports before the local type imports below them, matching the file's existing order."
    verify:
      - "grep -c \"from 'node:crypto'\" src/lib/agentic-tools-fs-adapter.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "randomUUID is imported from node:crypto."
      - "The other three imports are unchanged and still in order."
      - "package.json was not edited."
      - "The type-check passes."
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 9.2 Give each atomic text write its own temp filename
    ```yaml
    description: "Two concurrent writes to one path from one process shared a single pid-keyed temp file."
    author: Anthony Koukoullis
    issues: [ISS-41-qbdzgt]
    implement:
      - |
        src/lib/agentic-tools-fs-adapter.ts
        <<<<<<< SEARCH
            // Writes to a sibling `${path}.${process.pid}.tmp` file first, then
            // renames it over the target — the same reasoning as src/lib/projects.ts's
            // writeProjects (src/lib/projects.ts:42-47), generalized here from one
            // fixed registryPath to any caller-supplied path. The tmp file must be a
            // sibling of the real path (same directory), never under the OS temp
            // directory, or fs.rename can fail with EXDEV across filesystems.
            async writeTextFileAtomic(path: string, content: string): Promise<void> {
              const tmpPath = `${path}.${process.pid}.tmp`;
              await fs.writeFile(tmpPath, content, 'utf8');
              await fs.rename(tmpPath, path);
            },
        =======
            // Writes to a sibling temp file first, then renames it over the target
            // — the same reasoning as src/lib/projects.ts's writeProjects
            // (src/lib/projects.ts:42-47), generalized here from one fixed
            // registryPath to any caller-supplied path. The tmp file must be a
            // sibling of the real path (same directory), never under the OS temp
            // directory, or fs.rename can fail with EXDEV across filesystems.
            // The name carries a per-call random suffix as well as the pid: a
            // pid-only name is shared by two concurrent writes to the same path
            // from ONE process, which lets the second writeFile interleave with
            // the first rename and leave a truncated or mixed file behind.
            async writeTextFileAtomic(path: string, content: string): Promise<void> {
              const tmpPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
              await fs.writeFile(tmpPath, content, 'utf8');
              await fs.rename(tmpPath, path);
            },
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-fs-adapter.ts, writeTextFileAtomic and its comment only."
    imports: "randomUUID, added by task 9.1. Apply that task first."
    compatibility: "writeBinaryFileAtomic keeps its pid-only name. Its only caller writes one temporary zip with a single reader in the same process, and the issue names the text path alone."
    gotcha: "The `const tmpPath = ...` line appears twice in this file. The SEARCH block includes the whole function and its comment, so it matches only the text one."
    verify:
      - "grep -c 'randomUUID()' src/lib/agentic-tools-fs-adapter.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "grep -c 'process.pid' src/lib/agentic-tools-fs-adapter.ts — returns 3 at f0b0a8c; must return 2 after this task, because the pid stays in both temp names while the rewritten comment no longer spells process.pid."
      - "npx tsc --noEmit -p tsconfig.json — must pass."
    checklist:
      - "The text temp name carries both the pid and a random suffix."
      - "writeBinaryFileAtomic is unchanged."
      - "The temp file is still a sibling of the target path."
      - "The rename still follows the write."
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 9.3 Serialize `installToTarget` per registry path
    ```yaml
    description: "One in-flight read-modify-write per registry path, so a second install queues instead of computing its next state from a stale copy."
    author: Anthony Koukoullis
    issues: [ISS-41-qbdzgt]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
        export async function installToTarget(
          target: InstallTarget,
          content: InstallContent,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess },
        ): Promise<InstallResult> {
        =======
        // One in-flight install per registry path, chained through a promise per
        // path. Without it two overlapping requests both read the registry, both
        // compute a next state from their own stale copy, and the second write
        // drops the first tool's record. An in-process chain is the whole fix
        // here: one server process owns the registry, and the project ships no
        // runtime dependency to reach for a file lock with.
        const registryChains = new Map<string, Promise<unknown>>();

        function withRegistryLock<T>(registryPath: string, run: () => Promise<T>): Promise<T> {
          const previous = registryChains.get(registryPath) ?? Promise.resolve();
          const next = previous.then(run);
          // The stored link swallows rejection; the returned promise does not. A
          // failed install must reject its own caller without failing every
          // install queued behind it.
          registryChains.set(registryPath, next.catch(() => undefined));
          return next;
        }

        export function installToTarget(
          target: InstallTarget,
          content: InstallContent,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess },
        ): Promise<InstallResult> {
          return withRegistryLock(registryPath, () => installToTargetLocked(target, content, registryPath, deps));
        }

        async function installToTargetLocked(
          target: InstallTarget,
          content: InstallContent,
          registryPath: string,
          deps: { fsWrite: FsWriteAccess },
        ): Promise<InstallResult> {
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, the installToTarget signature only. The long comment above it stays attached to the exported wrapper."
    imports: "None."
    compatibility: "The exported name, parameters and return type are unchanged, so every caller and every test is unaffected. The map is keyed on the registry path, so two different registries still install in parallel."
    gotcha: "removeInstallation is left unserialized. ISS-41-qbdzgt names installToTarget's read at :91 and write at :147 only; widening the lock to removal is not part of this issue."
    verify:
      - "grep -c 'installToTargetLocked' src/lib/agentic-tools-install.ts — returns 0 before this task (exit 1); returns 2 after it."
      - |
        npm run build && node --input-type=module -e "
        import { installToTarget } from './dist/lib/agentic-tools-install.js';
        import { TOOL_CATALOGUE } from './dist/lib/agentic-tools-catalogue.js';
        const files=new Map();
        const fsWrite={async readTextFile(p){return files.has(p)?files.get(p):null;},async writeTextFileAtomic(p,c){await new Promise(r=>setTimeout(r,5));files.set(p,c);},async readBinaryFile(){return null;},async writeBinaryFileAtomic(){},async mkdir(){},async remove(){},async expandTokens(p){return p;}};
        const mk=(id)=>({tool:TOOL_CATALOGUE.find(t=>t.id===id),basePath:'/tmp/fakebase/'+id,scope:{kind:'global'}});
        const c={version:'1',skills:[{id:'a',name:'A',description:'',body:'x'}]};
        await Promise.all([
          installToTarget(mk('claude-code'),c,'/tmp/fakebase/reg.json',{fsWrite}),
          installToTarget(mk('opencode'),c,'/tmp/fakebase/reg.json',{fsWrite}),
        ]);
        console.log('records:',JSON.parse(files.get('/tmp/fakebase/reg.json')).map(r=>r.toolId).sort().join(','));
        "
        At f0b0a8c this prints one tool id, because the second write overwrites the first
        record. After this task it must print: records: claude-code,opencode
      - "npm run build && node --test dist/test/unit/agentic-tools-install.test.js — must still report 0 fail."
    checklist:
      - "installToTarget's exported signature is unchanged."
      - "The chain is keyed on the registry path."
      - "A rejected install does not reject the ones queued behind it."
      - "The concurrency probe reports both tool ids."
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 10. Join and split install paths with the host separator rules (ISS-45-fugjwv)

  ```yaml
  description: "Paths are built with a hardcoded forward slash and the mkdir target is derived with a forward-slash-only regular expression, so a Windows base path mis-derives the directory the engine creates. Latent: Windows is not a shipping target."
  ```

  - [ ] 10.1 Use `path.join` and `path.dirname` in the install write loop
    ```yaml
    description: "node:path is already imported in this file for the containment gate."
    author: Anthony Koukoullis
    issues: [ISS-45-fugjwv]
    implement:
      - |
        src/lib/agentic-tools-install.ts
        <<<<<<< SEARCH
            const fullPath = `${target.basePath}/${write.relativePath}`;
            // Containment gate in front of the write: resolve both sides with the
            // host's own rules and compare on a separator boundary, so a sibling
            // directory whose name merely begins with the base's name is refused.
            const resolvedBase = path.resolve(target.basePath);
            const resolvedFull = path.resolve(fullPath);
            if (!resolvedFull.startsWith(resolvedBase + path.sep)) {
              throw new Error(`Refusing to write outside the install target: ${write.relativePath}`);
            }
            const dir = fullPath.replace(/\/[^/]+$/, '');
        =======
            // path.join, not a hardcoded '/': a Windows configDir expands with
            // backslashes, and joining it to a forward-slash template produced a
            // mixed-separator path that the directory derivation below then
            // mis-split. path.dirname applies the host's own separator rules.
            const fullPath = path.join(target.basePath, write.relativePath);
            // Containment gate in front of the write: resolve both sides with the
            // host's own rules and compare on a separator boundary, so a sibling
            // directory whose name merely begins with the base's name is refused.
            const resolvedBase = path.resolve(target.basePath);
            const resolvedFull = path.resolve(fullPath);
            if (!resolvedFull.startsWith(resolvedBase + path.sep)) {
              throw new Error(`Refusing to write outside the install target: ${write.relativePath}`);
            }
            const dir = path.dirname(fullPath);
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-install.ts, the join and the directory derivation inside the write loop."
    imports: "None. node:path is already imported."
    compatibility: "Depends on task 4.2, which rewrote the surrounding loop but left both of these lines byte-identical. Apply task 4.2 first."
    gotcha: "path.join normalises the joined result, so on POSIX the produced paths are unchanged and the install unit suite's exact path assertions still hold. Run that suite to confirm."
    verify:
      - "grep -c 'path.join(target.basePath, write.relativePath)' src/lib/agentic-tools-install.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
      - "npm run build && node --test dist/test/unit/agentic-tools-install.test.js — must report 0 fail, with the same exact path strings asserted."
    checklist:
      - "The join uses path.join."
      - "The directory is derived with path.dirname."
      - "The containment gate between them is unchanged."
      - "Every path assertion in the install suite still passes."
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 10.2 Import `node:path` in the presence checker
    ```yaml
    description: "That module joins paths today with no path import at all."
    author: Anthony Koukoullis
    issues: [ISS-45-fugjwv]
    implement:
      - |
        src/lib/agentic-tools-skill-presence.ts
        <<<<<<< SEARCH
        import type { ToolDefinition } from './agentic-tools-catalogue.js';
        import type { FsAccess } from './agentic-tools-signals.js';
        =======
        // node:path is pure path algebra and touches no filesystem, so it does
        // not breach this module's read-only, FsAccess-only contract.
        import path from 'node:path';

        import type { ToolDefinition } from './agentic-tools-catalogue.js';
        import type { FsAccess } from './agentic-tools-signals.js';
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-skill-presence.ts, the import block."
    imports: "node:path, a Node built-in, matching how src/lib/agentic-tools-install.ts already imports and justifies it."
    compatibility: "This module is Node-side and is never bundled for the browser."
    gotcha: "Keep the built-in import above the local ones, and keep the blank line between the two groups."
    verify:
      - "grep -c \"import path from 'node:path'\" src/lib/agentic-tools-skill-presence.ts — returns 0 at f0b0a8c (exit 1); returns 1 after this task."
    checklist:
      - "node:path is imported."
      - "The four existing imports are unchanged."
      - "The comment records why the import is allowed here."
      - "The type-check passes."
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 10.3 Join both presence-check paths with `path.join`
    ```yaml
    description: "The per-skill probe and the shared-document probe both build their path with a hardcoded slash."
    author: Anthony Koukoullis
    issues: [ISS-45-fugjwv]
    implement:
      - |
        src/lib/agentic-tools-skill-presence.ts
        <<<<<<< SEARCH
          if (format.kind === 'skill-directory' || format.kind === 'rule-directory') {
            // skillDirectoryWrites/ruleDirectoryWrites each emit exactly one
            // FileWrite per input skill, in the same order as content.skills, so
            // writes[i] corresponds to skillIds[i].
            const presentSkillIds: string[] = [];
            const missingSkillIds: string[] = [];
            for (let i = 0; i < skillIds.length; i++) {
              const fullPath = `${basePath}/${writes[i].relativePath}`;
              const exists = await fsAccess.pathExists(fullPath);
              if (exists) {
                presentSkillIds.push(skillIds[i]);
              } else {
                missingSkillIds.push(skillIds[i]);
              }
            }
            const status =
              missingSkillIds.length === 0 ? 'fully-installed' : presentSkillIds.length === 0 ? 'not-installed' : 'missing-incomplete';
            return { checkKind: 'per-skill', status, presentSkillIds, missingSkillIds };
          }

          // format.kind is 'single-rule-file' or 'markdown-context-file': formatForTarget's
          // singleDocumentWrite always emits exactly one shared FileWrite regardless
          // of skill count, so no individual skill's presence can be distinguished
          // within it — return the coarser shared-file result from a single
          // pathExists call on that one resolved path.
          const fullPath = `${basePath}/${writes[0].relativePath}`;
        =======
          if (format.kind === 'skill-directory' || format.kind === 'rule-directory') {
            // skillDirectoryWrites/ruleDirectoryWrites each emit exactly one
            // FileWrite per input skill, in the same order as content.skills, so
            // writes[i] corresponds to skillIds[i].
            const presentSkillIds: string[] = [];
            const missingSkillIds: string[] = [];
            for (let i = 0; i < skillIds.length; i++) {
              // path.join, not a hardcoded '/', so the probed path matches what
              // the install engine writes on every platform.
              const fullPath = path.join(basePath, writes[i].relativePath);
              const exists = await fsAccess.pathExists(fullPath);
              if (exists) {
                presentSkillIds.push(skillIds[i]);
              } else {
                missingSkillIds.push(skillIds[i]);
              }
            }
            const status =
              missingSkillIds.length === 0 ? 'fully-installed' : presentSkillIds.length === 0 ? 'not-installed' : 'missing-incomplete';
            return { checkKind: 'per-skill', status, presentSkillIds, missingSkillIds };
          }

          // format.kind is 'single-rule-file' or 'markdown-context-file': formatForTarget's
          // singleDocumentWrite always emits exactly one shared FileWrite regardless
          // of skill count, so no individual skill's presence can be distinguished
          // within it — return the coarser shared-file result from a single
          // pathExists call on that one resolved path.
          const fullPath = path.join(basePath, writes[0].relativePath);
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-skill-presence.ts, the tail of checkSkillPresence covering both joins."
    imports: "path, added by task 10.2. Apply that task first."
    compatibility: "path.join normalises the result, so on POSIX the probed paths are unchanged and the presence unit suite's exact path fixtures still match."
    gotcha: "The two joins are not adjacent, so this one block spans the region between them. Nothing else in that region changes."
    verify:
      - "grep -c 'path.join(basePath,' src/lib/agentic-tools-skill-presence.ts — returns 0 at f0b0a8c (exit 1); returns 2 after this task."
      - "npm run build && node --test dist/test/unit/agentic-tools-skill-presence.test.js — must report 0 fail."
      - "npm run build && npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p src/public/tsconfig.json — both must pass as the closing state of this list."
    checklist:
      - "Both joins use path.join."
      - "No other logic in checkSkillPresence changed."
      - "The presence suite passes with its existing path fixtures."
      - "Both type-checks pass."
    self_eval:
      passed: false
      failures: []
    ```

## Skipped

1. **ISS-32-3hfjhe — no interface control reaches `removeInstallation`.** The issue
   carries `status: blocked`. Its own notes state that the direction, whether to
   surface a remove control or delete the unreachable wiring, is an undecided
   maintainer decision, and that no task may be authored from it until that decision
   is made. No task authored, and no direction chosen here.

2. **ISS-38-gv3p2x — two format writers drop every bundled reference file.** Both
   directions the issue's `expected` names add capability rather than correct existing
   code. Writing the files would need a new on-disk layout for reference material
   under a flat rules directory, which no tool documents and which the issue does not
   specify. Reporting a partial write would need a new field on `InstallResult`, plus
   its mirror in `src/public/lib/agentic-tools-api.ts` and a new label in
   `INSTALL_STATUS_LABEL`. The issue names no direction, so a task would build a
   feature. Tasks 1 and 2 do not widen the reach of this defect. After them no
   catalogue entry selects `single-rule-file` or `markdown-context-file` at either
   scope, so `singleDocumentWrite` stays unreachable, and `ruleDirectoryWrites` stays
   reachable through Cursor and Windsurf at project scope, the only scope either now
   declares it at.

3. **ISS-39-mu5wkq — `installAllGlobal` reports every failure as
   `skipped-no-format`.** Task 3 removes that function under ISS-43-xszeei, so the
   defect ceases to exist rather than being corrected in place. Correcting it instead
   would mean adding a new member to the shipped `InstallStatus` union, mirroring it
   in `src/public/lib/agentic-tools-api.ts`, and adding a user-facing label in
   `INSTALL_STATUS_LABEL` for a state no caller can reach. That is new functionality
   in dead code.

4. **ISS-42-q1t9bh — presence is checked against a hand-maintained id list.** The
   expected outcome is that the check compares what is on disk against what the
   install actually wrote. The ledger records paths, never skill ids, so a task would
   have to add that capability and then reverse a documented decision: the first
   three lines of the header of `src/lib/agentic-tools-skill-presence.ts` state that
   the module detects presence independently of this app's own install-tracking
   ledger, naming `agentic-tools-install-tracking.ts` and `.praxis-installs.json`.
   That header cites no issue id. The issue also names WS-44-h5cpzp as the
   workstream meant to replace `CANONICAL_PRAXIS_SKILL_IDS`.

5. **ISS-46-j993sr — a ledger record written before `resolvedPaths` names one path,
   so a cleanup driven by it cannot find the rest.** The issue carries
   `status: ready`, and it records the residual gap that tasks 4 and 5 leave behind:
   a record already on disk in the single-`resolvedPath` shape names one path, so the
   corrected cleanup reaches that one path and no other. On a machine that installed
   the pre-rename `prx-*` suite, seven skill directories and their bundled reference
   files stay named by no record at all. The issue's own notes name no direction and
   recommend none, because deriving the missing paths, for example by deleting a whole
   skills directory, is refused: it could delete files FlowCharge never wrote. That is
   the same ground on which ISS-38-gv3p2x is skipped above. Divergence 4 records the
   same gap from the task side. No task authored, and no direction chosen here.

## Divergences

1. **The Electron IPC mirror keeps the single-path removal.**
   `electron/agentic-tools-ipc-handlers.cts:484` resolves `record.resolvedPath` for its
   own containment check and calls `removeInstallation` at :496, hand-mirroring the
   HTTP route. Task 4 changes what `removeInstallation` deletes, so that handler now
   validates one path while the engine deletes every recorded path. Task 6 likewise
   corrects only the HTTP route's permitted-root check for a record with no recorded
   path; the handler's copy of that check at :484 keeps refusing such a record.
   `electron/` is leftover scaffolding with no release path per `CLAUDE.md`, so no
   task edits it. Recorded rather than fixed.

2. **The HTTP remove route validates every recorded path.** Closed by task 4.5. At
   `f0b0a8c`, `src/http/routes-integrations.ts:370` ran
   `path.resolve(record.resolvedPath)` and checked that one value against the
   permitted root before calling `removeInstallation`. Task 4.3 makes the engine
   delete every path `recordedInstallPaths` answers, which on its own would have
   turned a guarded single delete into a multi-delete with only its first path
   guarded: a ledger that is corrupt, hand-edited or tampered with, whose first path
   sits inside the permitted root and whose second does not, passed the check and had
   the second path deleted recursively. Task 4.5 imports that same
   `recordedInstallPaths` into the route, applies the unchanged rule to every path in
   it (resolved, strictly inside the permitted root on a separator boundary, never
   equal to the root), and refuses the whole request with 400 before anything is
   deleted if any one path fails. Task 6 keeps that loop and skips it only for a record
   naming no non-empty path. Measured in a scratch copy of `f0b0a8c`: with the list as
   it stood before task 4.5, the outside-path probe in that task answered 200 and the
   path outside the root was gone; after task 4.5 it answers 400 with both files
   present and the record still in the ledger. A legitimate two-path record inside the
   root still answers 200 with both files gone. A ledger this app wrote never fails the
   check, because every path in it passed the write-time containment gate in
   `installToTarget`. The Electron mirror of this check is Divergence 1.

3. **`resolveBasePathForScope` is named as affected but is not changed.**
   ISS-33-6bxf6h and ISS-34-mpy9n0 both list
   `src/public/lib/agentic-tools-scope.ts:19` among their affected lines. The browser
   cannot select a format: `ToolDetectionRow` in
   `src/public/lib/agentic-tools-api.ts:28-33` carries no `integrationFormats`, and the
   detect route sends none. Passing a format to that function would mean widening the
   detect payload across the route, the browser mirror and the Electron mirror. It is
   also unnecessary: the function returns exactly `resolvedConfigDir` at global scope
   and exactly `projectPath` at project scope, which is precisely what the
   scope-tagged catalogue entries in tasks 1 and 2 are relative to, and what the
   route's exact-equality permitted-root check already requires. The visible
   consequence is that a row ineligible at a scope stays clickable and reports
   `skipped-no-format` after the attempt, rather than showing a disabled checkbox
   before it. Both issues' `expected` allow an ineligibility report.

4. **Task 5 cannot fully clean a ledger record written before `resolvedPaths`.**
   Task 5 deletes the previous install through `recordedInstallPaths`, which falls
   back to the single `resolvedPath` for any record written before the
   `resolvedPaths` field task 4.1 adds. ISS-36-vl2cpx names the pre-rename `prx-*`
   case specifically, and that case is exactly the one the fallback cannot fully
   clean: the old record names one path, and the other seven `prx-*` directories are
   recorded nowhere. So task 5 fully cleans a record carrying `resolvedPaths`, and
   cleans only the single recorded path for a legacy record, which leaves the
   pre-rename orphans ISS-36-vl2cpx names on disk. Deriving the rest instead — for
   example by deleting a whole skills directory — is refused, because it could remove
   files FlowCharge never wrote. Recorded rather than fixed, and filed as its own
   defect in IL-16-78bnrq as ISS-46-j993sr.

5. **Removal and update cleanup delete files, not the directories the install
   created.** Task 4.2 records every path `writeTextFileAtomic` wrote; the `mkdir`
   calls beside those writes are not recorded, because a recursive `mkdir` cannot tell
   a directory it created from one that already existed. After task 4.3's removal, or
   task 5's update cleanup, each per-skill directory (`skills/<id>/` for a
   skill-directory format) is left behind empty. Measured on a real filesystem in a
   scratch base: an install of two skills, an update to two renamed skills and a
   removal leave one user-authored sibling file intact, zero FlowCharge files, and
   four empty per-skill directories. No tool loads a skill from an empty directory.
   Deleting the parent directory instead is refused on the same ground as
   Divergence 4: for a rule-directory format that parent is `.cursor/rules/`, which
   holds the user's own rules. ISS-35-m54y06's expected outcome names directories as
   well as files, so this is recorded as a residue of that fix.
