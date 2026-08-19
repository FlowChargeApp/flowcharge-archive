// Static, per-tool data catalogue for agentic coding tool detection. This file
// knows only tool FACTS — paths, formats, confidence tags. It must never import
// FsAccess or perform any filesystem/PATH/OS-detection logic; that boundary is
// what lets a fifth-tool addition stay a pure data change (see
// agentic-tools-signals.ts and agentic-tools-detect.ts for the evaluation side).

export type OS = 'macos' | 'linux' | 'windows';
export type ToolCategory = 'cli' | 'gui-app';
export type SourceConfidence = 'verified' | 'carried-from-investigation' | 'placeholder-unverified';

export interface OsPath {
  path: string; // may contain '~' or '%VAR%' tokens; FsAccess resolves them
  sourceConfidence: SourceConfidence;
  citation?: string; // URL, present when sourceConfidence === 'verified'
}

export interface IntegrationFormat {
  kind: 'skill-directory' | 'rule-directory' | 'single-rule-file'
      | 'mcp-json' | 'markdown-context-file' | 'structured-config-file';
  pathTemplate: string; // e.g. 'skills/<name>/SKILL.md', relative to configDir or project root
  deprecatedFallback?: string;
  notes?: string;
}

export interface ToolDefinition {
  id: string; // 'claude-code' | 'cursor' | 'windsurf' | 'opencode'
  displayName: string;
  category: ToolCategory;
  configDir: Partial<Record<OS, OsPath[]>>; // candidate list, not a single path
  installPaths?: Partial<Record<OS, OsPath[]>>; // gui-app only: app-bundle/install-location candidates (primary signal), distinct from configDir (corroborating signal)
  pathBinaryNames?: string[]; // cli category, plus optional Linux gui-app corroborating signal
  integrationFormats: IntegrationFormat[];
}

// Later tasks append entries to this array.
export const TOOL_CATALOGUE: ToolDefinition[] = [
  // Claude Code — carried exactly as Context supplied it (high confidence
  // already, not re-verified this pass), per the plan's Verified catalogue.
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    category: 'cli',
    pathBinaryNames: ['claude'],
    configDir: {
      macos: [{ path: '~/.claude/', sourceConfidence: 'carried-from-investigation' }],
      linux: [{ path: '~/.claude/', sourceConfidence: 'carried-from-investigation' }],
      windows: [{ path: '%USERPROFILE%\\.claude\\', sourceConfidence: 'carried-from-investigation' }],
    },
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
  },

  // Cursor — checked this pass against current documentation; citations inline.
  // See prxplan.md's Verified catalogue section for the full source list.
  {
    id: 'cursor',
    displayName: 'Cursor',
    category: 'gui-app',
    pathBinaryNames: ['cursor'], // Linux has no single install path; the PATH binary is the practical Linux signal.
    configDir: {
      macos: [{
        path: '~/.cursor/',
        sourceConfidence: 'verified',
        citation: 'https://cursor.com/help/customization/rules',
      }],
      linux: [{
        path: '~/.cursor/',
        sourceConfidence: 'verified',
        citation: 'https://cursor.com/help/customization/rules',
      }],
      windows: [{
        path: '%USERPROFILE%\\.cursor\\',
        sourceConfidence: 'verified',
        citation: 'https://cursor.com/help/customization/rules',
      }],
    },
    installPaths: {
      // Standard convention, not independently re-sourced this pass.
      macos: [{ path: '/Applications/Cursor.app', sourceConfidence: 'carried-from-investigation' }],
      // Per-user Electron-builder install — not Program Files.
      windows: [{
        path: '%LOCALAPPDATA%\\Programs\\cursor\\',
        sourceConfidence: 'verified',
        citation: 'https://forum.cursor.com/t/system-installer-for-windows/17343',
      }],
    },
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
  },

  // Windsurf — checked this pass against current documentation. Major finding:
  // docs.windsurf.com now 307-redirects to docs.devin.ai (Cognition/Devin
  // branding); citations below point at the post-redirect docs.devin.ai URLs.
  {
    id: 'windsurf',
    displayName: 'Windsurf',
    category: 'gui-app',
    configDir: {
      macos: [{
        path: '~/.codeium/windsurf/',
        sourceConfidence: 'verified',
        citation: 'https://docs.devin.ai/desktop/cascade/memories',
      }],
      linux: [{
        path: '~/.codeium/windsurf/',
        sourceConfidence: 'verified',
        citation: 'https://docs.devin.ai/desktop/cascade/memories',
      }],
      // The primary doc lists '~/.codeium/windsurf/' verbatim even for Windows
      // (an unusual literal '~'); this is the practical Windows translation,
      // pending a real Windows check.
      windows: [{ path: '%USERPROFILE%\\.codeium\\windsurf\\', sourceConfidence: 'placeholder-unverified' }],
    },
    installPaths: {
      // Lower-authority single source; conflicts with Cursor's confirmed
      // per-user pattern from a comparable Electron-based competitor.
      windows: [{ path: 'C:\\Program Files\\Windsurf', sourceConfidence: 'placeholder-unverified' }],
    },
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
  },

  // OpenCode — checked this pass against current documentation; citations inline.
  {
    id: 'opencode',
    displayName: 'OpenCode',
    category: 'cli',
    pathBinaryNames: ['opencode'],
    configDir: {
      macos: [{
        path: '~/.config/opencode/',
        sourceConfidence: 'verified',
        citation: 'https://opencode.ai/docs/config/',
      }],
      linux: [{
        path: '~/.config/opencode/',
        sourceConfidence: 'verified',
        citation: 'https://opencode.ai/docs/config/',
      }],
      // OpenCode's own docs do not state a Windows path; this is kept only as a
      // best-guess candidate, not asserted as fact, pending a real Windows check.
      windows: [{ path: '%APPDATA%\\opencode\\', sourceConfidence: 'placeholder-unverified' }],
    },
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
  },
];
