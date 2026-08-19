// Orchestration: dispatches each catalogue entry to its category's signal
// function and runs the full catalogue. Knows how to iterate the catalogue and
// dispatch by category; must never know fs/PATH mechanics (those live entirely
// behind FsAccess) and must never branch on a specific tool id.

import type { OS, ToolDefinition } from './agentic-tools-catalogue.js';
import { TOOL_CATALOGUE } from './agentic-tools-catalogue.js';
import type { DetectionResult, FsAccess } from './agentic-tools-signals.js';
import { cli, guiApp } from './agentic-tools-signals.js';

export async function detectTool(definition: ToolDefinition, fsAccess: FsAccess, os: OS): Promise<DetectionResult> {
  switch (definition.category) {
    case 'cli':
      return cli(definition, fsAccess, os);
    case 'gui-app':
      return guiApp(definition, fsAccess, os);
    default:
      throw new Error(`agentic-tools-detect: no signal function for category ${definition.category}`);
  }
}

export async function detectAllTools(fsAccess: FsAccess, os: OS): Promise<DetectionResult[]> {
  return Promise.all(TOOL_CATALOGUE.map((definition) => detectTool(definition, fsAccess, os)));
}
