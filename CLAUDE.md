# Project facts — read before planning or documenting this app

**No Electron.** FlowCharge ships as a CLI binary only, starting a local web server the user
reaches through a browser. There is no Electron desktop app, and none is planned for the
foreseeable future — Windows and macOS notarization requirements make it not worth pursuing
for an unproven app with no users yet. The `electron/` directory, `electron`/`electron-builder`
in `package.json`, and the `package:mac`/`package:linux`/`package:win` scripts are leftover
scaffolding, not a real release path. Treat any doc, plan, or task that calls Electron "a
supported path," asks for an `npm run electron:dev` check, or requires Electron parity as
acting on stale information — flag it, don't act on it.

**Product name is "FlowCharge"**, never "FlowCharge Board" or "FlowCharge Dashboard" — the
board is a view inside the app, not the app's name.

**FlowCharge (the application) is not open source.** FlowCharge Core (the skill suite,
published separately) is MIT.
