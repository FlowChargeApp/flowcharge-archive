# DownloadAlbum baseline — captured before the Phase 5 migration

Captured 2026-08-17 by task 5.2, before any dry run.
Source: dist/scripts/extract-praxis-data.js, the dashboard's own extraction path.
The --check output is saved alongside as downloadalbum-check.txt (0 errors, 175 warnings, exit 2).
The pre-run `git status --porcelain` is saved as downloadalbum-git-before.txt (61 lines, all
pre-existing uncommitted AK-to-Praxis migration changes, none made by this workstream).

- Workstream count: 28
- Issue count: 39
- Artefact count: 93 (28 WS, 65 PLN/IL/TL)
- Claim markers: 115 under flowcharge/ids/
- Files under flowcharge/: 97
- Git repository, but flowcharge/ids/ is gitignored, so the backup is the only path back for markers.

## Workstream order, as the dashboard renders it

1. WS-1 — Set up the tiddl CLI [backlog]
2. WS-10 — Monochrome.tf Pre-Coding Research Phase [in-progress]
3. WS-11 — Node v2 of download-album.js driving the monochrome.tf UI with real Chrome [done]
4. WS-12 — Batch runner script that reads an album/artist list file and calls download-album-v2 per line [done]
5. WS-13 — Add FFmpeg HE-AAC recompression stage to the batch runner [done]
6. WS-14 — Automated MusicBrainz metadata tagging of recompressed files [done]
7. WS-15 — Separate FLAC and recompressed output bases for the batch runner [done]
8. WS-16 — Reorganize legacy SpotifyExodus Monochrome and Minichrome trees by volume [in-progress]
9. WS-17 — Reorganize legacy SpotifyExodus trees by volume using Spotify CSV exports [done]
10. WS-18 — CSV playlist export support for download-album-list with per-volume output layout [done]
11. WS-19 — Move Playwright browser window off-screen during download-album-v2 runs [done]
12. WS-2 — Organize the Monochrome archive by volume [backlog]
13. WS-20 — Fix re-download and search-match bugs in monochrome.tf downloader [done]
14. WS-21 — Fix monochrome.tf search query format to include artist alongside album [done]
15. WS-22 — Fix ReferenceError: normalizeForMatch is not defined in page.$$eval browser context [done]
16. WS-23 — Investigate false-positive skips and 'nothing to download' failures in album download pipeline [done]
17. WS-24 — Albums already present on disk are re-downloaded after skip check regression [done]
18. WS-25 — Album downloads not saving to destination folder and skipping recompression [done]
19. WS-26 — Chrome shows unsupported --no-sandbox warning banner when Playwright opens it for album downloads [backlog]
20. WS-27 — Record albums that were not found during downloads to a manifest file in the destination FLAC folder [in-progress]
21. WS-28 — Fix inconsistencies in the Praxis project-management files [done]
22. WS-3 — Automated batch TIDAL downloader [backlog]
23. WS-4 — Automated Minichrome recompression pipeline [backlog]
24. WS-5 — Python CLI for Antra FLAC downloads via Playwright [in-progress]
25. WS-6 — Playwright browser automation for monochrome.tf [in-progress]
26. WS-7 — CLI for downloading tracks and albums from monochrome.tf [in-progress]
27. WS-8 — FLAC metadata extraction and tagging [in-progress]
28. WS-9 — Monochrome.tf Site Scouting & Code Remediation [in-progress]

## Artefact order within each workstream

### WS-1
(no artefacts)

### WS-10
(no artefacts)

### WS-11
1. PLN-8 (plan, done)
2. TL-24 (tasklist, done, 11/11)
3. TL-25 (tasklist, done, 7/7)

### WS-12
1. PLN-9 (plan, done)
2. TL-26 (tasklist, done, 12/12)

### WS-13
1. PLN-10 (plan, done)
2. TL-27 (tasklist, done, 9/9)

### WS-14
1. PLN-11 (plan, done)
2. TL-28 (tasklist, done, 11/11)

### WS-15
1. PLN-12 (plan, done)
2. TL-30 (tasklist, done, 8/8)

### WS-16
1. PLN-13 (plan, ready)
2. TL-32 (tasklist, ready, 3/11)

### WS-17
1. PLN-14 (plan, done)
2. TL-33 (tasklist, done, 7/7)

### WS-18
1. PLN-15 (plan, done)
2. TL-35 (tasklist, done, 7/7)

### WS-19
1. PLN-16 (plan, done)
2. TL-36 (tasklist, done, 6/6)

### WS-2
(no artefacts)

### WS-20
1. IL-18 (issuelist, done, 2/2)
2. TL-38 (tasklist, done, 2/2)

### WS-21
1. IL-19 (issuelist, done, 1/1)
2. TL-40 (tasklist, done, 2/2)

### WS-22
1. IL-20 (issuelist, done, 1/1)
2. TL-41 (tasklist, done, 1/1)

### WS-23
1. IL-21 (issuelist, done, 1/1)
2. TL-42 (tasklist, done, 2/2)

### WS-24
1. IL-22 (issuelist, done, 1/1)
2. TL-43 (tasklist, done, 1/1)

### WS-25
1. IL-24 (issuelist, done, 5/5)
2. IL-25 (issuelist, done, 3/3)
3. TL-44 (tasklist, done, 5/5)
4. TL-46 (tasklist, done, 2/2)
5. TL-49 (tasklist, done, 3/3)

### WS-26
(no artefacts)

### WS-27
1. PLN-18 (plan, ready)
2. TL-51 (tasklist, ready, 4/6)

### WS-28
1. IL-26 (issuelist, done, 22/22)
2. TL-52 (tasklist, done, 92/92)

### WS-3
(no artefacts)

### WS-4
(no artefacts)

### WS-5
1. IL-27 (issuelist, ready, 1/3)
2. TL-1 (tasklist, done, 10/10)
3. TL-2 (tasklist, done, 10/10)
4. TL-3 (tasklist, done, 6/6)
5. TL-4 (tasklist, done, 10/10)
6. TL-5 (tasklist, done, 8/8)
7. TL-6 (tasklist, ready, 2/3)
8. TL-7 (tasklist, done, 6/6)
9. TL-8 (tasklist, done, 2/2)
10. TL-9 (tasklist, done, 3/3)
11. TL-10 (tasklist, done, 2/2)
12. TL-11 (tasklist, ready, 1/2)
13. TL-12 (tasklist, done, 3/3)
14. TL-13 (tasklist, done, 1/1)
15. TL-14 (tasklist, ready, 1/1)
16. TL-15 (tasklist, ready, 1/1)
17. TL-16 (tasklist, done, 1/1)
18. TL-17 (tasklist, done, 0/1)
19. TL-18 (tasklist, done, 0/1)
20. TL-19 (tasklist, done, 0/3)
21. TL-20 (tasklist, done, 0/3)

### WS-6
1. PLN-4 (plan, ready)
2. TL-21 (tasklist, done, 5/5)

### WS-7
1. PLN-5 (plan, ready)
2. TL-22 (tasklist, done, 2/2)

### WS-8
1. PLN-6 (plan, ready)
2. TL-23 (tasklist, done, 5/5)

### WS-9
(no artefacts)

## Issue order

1. ISS-4 — parseAlbumDirFromStdout regex is fragile, causing re-downloads [high, done, WS-20]
2. ISS-5 — Card title extraction includes extra DOM text, causing search-match failures [high, done, WS-20]
3. ISS-6 — Search query includes " - " separator, causing monochrome.tf search to fail [high, done, WS-21]
4. ISS-7 — normalizeForMatch ReferenceError in page.$$eval search card extraction [critical, done, WS-22]
5. ISS-8 — audioFilesIn skip check reports false positives — directories contain files that don't belong to the album [high, done, WS-23]
6. ISS-9 — albumExists() only checks for .m3u — misses directories with audio files from previous downloads [critical, done, WS-24]
7. ISS-18 — captureDownload candidate filter never matches polling-dir filenames Chrome generates [critical, done, WS-25]
8. ISS-19 — Capture grace period expires before large files materialise in the poll directory [high, done, WS-25]
9. ISS-20 — AppleScript window-minimise command is malformed and errors on every launch [low, done, WS-25]
10. ISS-13 — Skip message format mismatch causes recompression to be silently skipped [high, done, WS-25]
11. ISS-14 — captureDownload event not reliably firing in persistent Chrome context [critical, done, WS-25]
12. ISS-15 — Post-resolution album identity navigation interferes with download capture [medium, done, WS-25]
13. ISS-16 — Download capture polls a directory Chrome is never configured to write to [critical, done, WS-25]
14. ISS-17 — ZIP extraction rejects audio that lives in subfolders of the album directory [high, done, WS-25]
15. ISS-21 — Artefacts in top-level issues/ and tasklists/ folders are invisible to the index [high, done, WS-28]
16. ISS-22 — Fourteen workstream folders lack the required WS-N- prefix [high, done, WS-28]
17. ISS-23 — Two workstream records are stored in files named tasklist.md [high, done, WS-28]
18. ISS-24 — Three stray plan.md files duplicate their plan.md twins [low, done, WS-28]
19. ISS-25 — Stale .lease files block future orchestrate runs [high, done, WS-28]
20. ISS-26 — Three issue files use an undocumented type value [medium, done, WS-28]
21. ISS-27 — depends_on is written as a YAML block list in five task lists [medium, done, WS-28]
22. ISS-28 — Task list TL-35 has no title key in frontmatter [medium, done, WS-28]
23. ISS-29 — Six artefact records omit the required links key [low, done, WS-28]
24. ISS-30 — WS-9 and WS-10 carry undocumented project and priority keys [low, done, WS-28]
25. ISS-31 — Eight workstreams have no tags key, so their board cards show no labels [low, done, WS-28]
26. ISS-32 — WS-22 has a camelCase slug value [low, done, WS-28]
27. ISS-33 — Four records use status values outside the documented enum [high, done, WS-28]
28. ISS-34 — WS-5 is marked done while several of its own artefacts are still open [medium, done, WS-28]
29. ISS-35 — WS-6, WS-7 and WS-8 read backlog although their work is done [medium, done, WS-28]
30. ISS-36 — Four task lists have a status that contradicts their checkbox state [medium, done, WS-28]
31. ISS-37 — index.md reports zero open issues while two issues are open [high, done, WS-28]
32. ISS-38 — Six artefacts use YAML item blocks instead of checkbox lines, so progress reads 0 of 0 [medium, done, WS-28]
33. ISS-39 — TL-35 uses heading lines instead of task checkboxes, so progress reads 0 of 0 [medium, done, WS-28]
34. ISS-40 — The WS-20 board card description ends mid-sentence [low, done, WS-28]
35. ISS-41 — Fifteen ID marker directories have no artefact file [low, done, WS-28]
36. ISS-42 — Many artefact files have no ID marker directory in the registry [medium, done, WS-28]
37. ISS-1 — BrowserManager not an async context manager; BrowserLaunchError missing import [high, ready, WS-5]
38. ISS-2 — Browser.set_default_timeout fails; cli.py missing logging import [high, done, WS-5]
39. ISS-3 — Wrong Antra URL, no login flow, wrong interaction model [high, ready, WS-5]
