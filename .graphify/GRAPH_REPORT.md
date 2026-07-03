# Graph Report - .  (2026-07-03)

## Corpus Check
- Corpus is ~21,925 words - fits in a single context window. You may not need a graph.

## Summary
- 251 nodes · 437 edges · 12 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 113 · PARENT_OF: 73 · ON_BRANCH: 72 · calls: 66 · method: 34 · MODIFIES: 32 · imports: 19 · imports_from: 19 · references: 5 · semantically_similar_to: 4


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 44 · Candidates: 61
- Excluded: 0 untracked · 11220 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `e5125d3`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `ModuleInstance` - 27 edges
2. `startMidiService()` - 8 edges
3. `startMidiService()` - 6 edges
4. `MockPort` - 6 edges
5. `_startHelperBackend()` - 5 edges
6. `sendMidiStep()` - 5 edges
7. `midiConfigSnapshot()` - 4 edges
8. `_startHelperBackend()` - 4 edges
9. `validateRackMidiMap()` - 4 edges
10. `parseMidiMapString()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Pre-Commit / CI Review Prompt` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist`  [INFERRED] [semantically similar]
  .github/git-commit-instructions.md → companion-release-checklist.md
- `Companion Module Review (Core) PR Template` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist`  [INFERRED] [semantically similar]
  .github/pull_request_template.md → companion-release-checklist.md
- `GitHub Copilot Instructions (Bitfocus Companion Module v4+)` --semantically_similar_to--> `Pre-Commit / CI Review Prompt`  [INFERRED] [semantically similar]
  .github/copilot-instructions.md → .github/git-commit-instructions.md
- `Pre-Commit / CI Review Prompt` --semantically_similar_to--> `Companion Module Review (Core) PR Template`  [INFERRED] [semantically similar]
  .github/git-commit-instructions.md → .github/pull_request_template.md
- `Waves SuperRack Router Inline Help` --references--> `README.md (Waves SuperRack Router Companion Module)`  [EXTRACTED]
  companion/HELP.md → README.md

## Hyperedges (group relationships)
- **Bitfocus Companion Core Maintainer Review/Governance Process** — copilot_instructions_doc, git_commit_instructions_doc, pull_request_template_doc, companion_release_checklist_doc [INFERRED 0.80]
- **Superrack Router HTTP UI Navigation Flow** — home_html, rack_channel_html, midi_plugin_html, midi_snapshot_html [EXTRACTED 0.90]
- **Test, Build and Release Pipeline** — pr_unit_test_workflow, release_on_version_change_workflow, package_json, manifest_json [EXTRACTED 0.85]

## Communities

### Community 0 - "ModuleInstance Core (Companion Lifecycle)"
Cohesion: 0.07
Nodes (57): { resolveRackForChannel }, micha/midi-connector, 03835ec chore: replace npm with yarn for dependency installation in CI workflow, 0733dc7 Use immutable yarn install in PR unit test workflow, 0838f6f chore: refresh architecture graph after MIDI service addition, 090aa6f chore: rename companion-module-checks.yaml to companion-module-checks.yaml.inactive, 0ad74fb chore: bump version to 0.4.3 in manifest and package files, 0ed48f7 feat: add unit tests for MIDI channel validation to prevent conflicts (+49 more)

### Community 1 - "Patch UI Frontend (app.js)"
Cohesion: 0.07
Nodes (31): 73bf20c fix: resolve default helper path in both bundled and unbundled layouts, e5125d3 fix: survive Companion 4 sandboxed module runtime (v0.6.1), e8b62fb chore: refresh architecture graph, ignore stray nested graphify caches, _findPortIndexByName(), fs, handleIncomingMidi(), HELPER_DEFAULT_RELATIVE, helperExePath() (+23 more)

### Community 2 - "Module Wiring (main/actions/feedbacks/variables)"
Cohesion: 0.08
Nodes (17): 161791c feat: reorder plugin and snapshot step execution for improved processing, 21b0865 chore: bump version to 0.3.0 in manifest and package files, 269a00c feat: add MIDI sequence retrieval for snapshots and plugins, refactor execution logic, 2fa3f6d feat: add home navigation button to mapping UIs and implement home page with grid layout, 376bcc0 feat: refactor MIDI mapping logic and streamline rack sequence execution, 4d37311 feat: update patch routes to serve rack-channel UI and add test route for home page, 4f6795d feat: add hotMap default mapping and expose in main module, 8d6c0a8 feat: enhance MIDI step execution with configurable delays and update timestamp handling (+9 more)

### Community 3 - "Docs & Governance (README/CHANGELOG/Checklists)"
Cohesion: 0.14
Nodes (4): ModuleInstance, UpdateActions, UpdateFeedbacks, UpdateVariableDefinitions

### Community 4 - "MIDI Map Parsing & Validation"
Cohesion: 0.11
Nodes (19): cellRefs, clearAllMappings(), clearBtn, exportBtn, homeBtn, importBtn, importInput, loadBtn (+11 more)

### Community 5 - "HTTP Server Integration Tests"
Cohesion: 0.19
Nodes (15): _findPortIndexByName(), fs, handleIncomingMidi(), HELPER_DEFAULT_RELATIVE, helperExePath(), _isEcho(), midiConfigSnapshot(), midiStepToBytes() (+7 more)

### Community 6 - "MIDI Plugin Frontend (midi.js)"
Cohesion: 0.26
Nodes (7): applyMidiStepToVariables(), parseMidiMapString(), resolveRackForChannel(), validateRackMidiMap(), { validateRackMidiMap, parseMidiMapString }, { validateRackMidiMap, parseMidiMapString }, { applyMidiStepToVariables }

### Community 7 - "HTTP Server Unit Tests"
Cohesion: 0.18
Nodes (6): request, { startHttpServer, stopHttpServer }, request, { startHttpServer, stopHttpServer }, fastifyFactory, fastifyStatic

### Community 8 - "Default Config & Hot Maps"
Cohesion: 0.22
Nodes (8): 44ba5b6 ci: resolve SDK nupkg from newest microsoft/MIDI release (all are pre-releases), 9a33ce7 ci: build module .tgz as workflow artifact for test builds, af1f7ba feat: Windows MIDI Services virtual device backend (wave W3, experimental), d142ac7 fix: include @julusian/midi prebuilds in module package, f9653aa chore: refresh architecture graph, net10.0-windows10.0.26100.0, Microsoft.Windows.Devices.Midi2, Microsoft.NET.Sdk

### Community 9 - "HTTP UI Pages (static HTML)"
Cohesion: 0.33
Nodes (6): Bitfocus Companion Module Release Checklist, GitHub Copilot Instructions (Bitfocus Companion Module v4+), Pre-Commit / CI Review Prompt, Waves SuperRack Router Inline Help, Companion Module Review (Core) PR Template, README.md (Waves SuperRack Router Companion Module)

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (4): channelInput, sendToServer(), typeSelect, updateMidiSetting()

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (4): buildServer(), fastifyFactory, fastifyStatic, request

## Knowledge Gaps
- **49 isolated node(s):** `path`, `fs`, `HELPER_DEFAULT_RELATIVE`, `{ InstanceBase, runEntrypoint, InstanceStatus }`, `UpgradeScripts` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ModuleInstance` connect `Docs & Governance (README/CHANGELOG/Checklists)` to `Module Wiring (main/actions/feedbacks/variables)`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `startMidiService()` connect `Patch UI Frontend (app.js)` to `Module Wiring (main/actions/feedbacks/variables)`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `path`, `fs`, `HELPER_DEFAULT_RELATIVE` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ModuleInstance Core (Companion Lifecycle)` be split into smaller, more focused modules?**
  _Cohesion score 0.07199032062915911 - nodes in this community are weakly interconnected._
- **Should `Patch UI Frontend (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07084785133565621 - nodes in this community are weakly interconnected._
- **Should `Module Wiring (main/actions/feedbacks/variables)` be split into smaller, more focused modules?**
  _Cohesion score 0.08045977011494253 - nodes in this community are weakly interconnected._
- **Should `Docs & Governance (README/CHANGELOG/Checklists)` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._