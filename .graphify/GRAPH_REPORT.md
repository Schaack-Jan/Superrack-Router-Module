# Graph Report - .  (2026-07-02)

## Corpus Check
- Corpus is ~12,133 words - fits in a single context window. You may not need a graph.

## Summary
- 127 nodes · 175 edges · 9 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 64 · calls: 43 · method: 27 · imports_from: 15 · references: 15 · imports: 6 · semantically_similar_to: 4 · shares_data_with: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 35 · Candidates: 50
- Excluded: 0 untracked · 11846 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.
## God Nodes (most connected - your core abstractions)
1. `ModuleInstance` - 27 edges
2. `README.md (Waves SuperRack Router Companion Module)` - 9 edges
3. `validateRackMidiMap()` - 4 edges
4. `parseMidiMapString()` - 4 edges
5. `persistMappingUpdate()` - 4 edges
6. `Bitfocus Companion Module Release Checklist` - 4 edges
7. `applyMidiStepToVariables()` - 3 edges
8. `loadFromCompanion()` - 3 edges
9. `showAlert()` - 3 edges
10. `Pre-Commit / CI Review Prompt` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Pre-Commit / CI Review Prompt` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist`  [INFERRED] [semantically similar]
  .github/git-commit-instructions.md → companion-release-checklist.md
- `Companion Module Review (Core) PR Template` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist`  [INFERRED] [semantically similar]
  .github/pull_request_template.md → companion-release-checklist.md
- `Waves SuperRack Router Inline Help` --references--> `README.md (Waves SuperRack Router Companion Module)`  [EXTRACTED]
  companion/HELP.md → README.md
- `PR Unit Test Workflow` --shares_data_with--> `package.json`  [INFERRED]
  .github/workflows/pr-unit-test.yaml → README.md
- `Bitfocus Companion Module Release Checklist` --references--> `companion/manifest.json`  [EXTRACTED]
  companion-release-checklist.md → README.md

## Hyperedges (group relationships)
- **Bitfocus Companion Core Maintainer Review/Governance Process** — copilot_instructions_doc, git_commit_instructions_doc, pull_request_template_doc, companion_release_checklist_doc [INFERRED 0.80]
- **Superrack Router HTTP UI Navigation Flow** — home_html, rack_channel_html, midi_plugin_html, midi_snapshot_html [EXTRACTED 0.90]
- **Test, Build and Release Pipeline** — pr_unit_test_workflow, release_on_version_change_workflow, package_json, manifest_json [EXTRACTED 0.85]

## Communities

### Community 0 - "ModuleInstance Core (Companion Lifecycle)"
Cohesion: 0.16
Nodes (1): ModuleInstance

### Community 1 - "Patch UI Frontend (app.js)"
Cohesion: 0.11
Nodes (19): cellRefs, clearAllMappings(), clearBtn, exportBtn, homeBtn, importBtn, importInput, loadBtn (+11 more)

### Community 2 - "Module Wiring (main/actions/feedbacks/variables)"
Cohesion: 0.12
Nodes (10): { combineRgb }, { applyMidiStepToVariables }, defaults, { InstanceBase, runEntrypoint, InstanceStatus }, { startHttpServer, stopHttpServer }, UpdateActions, UpdateFeedbacks, UpdateVariableDefinitions (+2 more)

### Community 3 - "Docs & Governance (README/CHANGELOG/Checklists)"
Cohesion: 0.16
Nodes (14): Bitfocus Companion Module Release Checklist, GitHub Copilot Instructions (Bitfocus Companion Module v4+), Pre-Commit / CI Review Prompt, Waves SuperRack Router Inline Help, lib/midi-map.js, main.js (Module Entry Point), companion/manifest.json, package.json (+6 more)

### Community 4 - "MIDI Map Parsing & Validation"
Cohesion: 0.29
Nodes (6): applyMidiStepToVariables(), parseMidiMapString(), validateRackMidiMap(), { validateRackMidiMap, parseMidiMapString }, { validateRackMidiMap, parseMidiMapString }, { applyMidiStepToVariables }

### Community 5 - "HTTP Server Integration Tests"
Cohesion: 0.18
Nodes (6): request, { startHttpServer, stopHttpServer }, request, { startHttpServer, stopHttpServer }, fastifyFactory, fastifyStatic

### Community 6 - "MIDI Plugin Frontend (midi.js)"
Cohesion: 0.40
Nodes (4): channelInput, sendToServer(), typeSelect, updateMidiSetting()

### Community 7 - "HTTP Server Unit Tests"
Cohesion: 0.40
Nodes (4): buildServer(), fastifyFactory, fastifyStatic, request

### Community 9 - "HTTP UI Pages (static HTML)"
Cohesion: 0.50
Nodes (4): Superrack Router Settings Home Page, MIDI Plugin Mapping Page, MIDI Snapshot Mapping Page, Patch Mappings (Rack <> Channel) Page

## Knowledge Gaps
- **40 isolated node(s):** `{ validateRackMidiMap, parseMidiMapString }`, `request`, `{ startHttpServer, stopHttpServer }`, `fastifyStatic`, `request` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `ModuleInstance Core (Companion Lifecycle)`** (1 nodes): `ModuleInstance`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ModuleInstance` connect `ModuleInstance Core (Companion Lifecycle)` to `Module Wiring (main/actions/feedbacks/variables)`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Why does `applyMidiStepToVariables()` connect `MIDI Map Parsing & Validation` to `Module Wiring (main/actions/feedbacks/variables)`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `{ validateRackMidiMap, parseMidiMapString }`, `request`, `{ startHttpServer, stopHttpServer }` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Patch UI Frontend (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.11067193675889328 - nodes in this community are weakly interconnected._
- **Should `Module Wiring (main/actions/feedbacks/variables)` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._