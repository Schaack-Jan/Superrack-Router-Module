# Graph Report - . (2026-07-02)

## Corpus Check

- Corpus is ~18,751 words - fits in a single context window. You may not need a graph.

## Summary

- 209 nodes · 364 edges · 16 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 86 · PARENT_OF: 63 · ON_BRANCH: 62 · calls: 50 · method: 34 · MODIFIES: 25 · imports_from: 19 · imports: 18 · semantically_similar_to: 4 · references: 3

## Input Scope

- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 39 · Candidates: 55
- Excluded: 0 untracked · 11176 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness

- Built from Git commit: `cf28de7`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `ModuleInstance` - 27 edges
2. `startMidiService()` - 7 edges
3. `MockPort` - 6 edges
4. `sendMidiStep()` - 5 edges
5. `validateRackMidiMap()` - 4 edges
6. `parseMidiMapString()` - 4 edges
7. `midiConfigSnapshot()` - 4 edges
8. `persistMappingUpdate()` - 4 edges
9. `applyMidiStepToVariables()` - 3 edges
10. `resolveRackForChannel()` - 3 edges

## Surprising Connections (you probably didn't know these)

- `Pre-Commit / CI Review Prompt` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist` [INFERRED] [semantically similar]
  .github/git-commit-instructions.md → companion-release-checklist.md
- `Companion Module Review (Core) PR Template` --semantically_similar_to--> `Bitfocus Companion Module Release Checklist` [INFERRED] [semantically similar]
  .github/pull_request_template.md → companion-release-checklist.md
- `GitHub Copilot Instructions (Bitfocus Companion Module v4+)` --semantically_similar_to--> `Pre-Commit / CI Review Prompt` [INFERRED] [semantically similar]
  .github/copilot-instructions.md → .github/git-commit-instructions.md
- `Pre-Commit / CI Review Prompt` --semantically_similar_to--> `Companion Module Review (Core) PR Template` [INFERRED] [semantically similar]
  .github/git-commit-instructions.md → .github/pull_request_template.md
- `Waves SuperRack Router Inline Help` --references--> `README.md (Waves SuperRack Router Companion Module)` [EXTRACTED]
  companion/HELP.md → README.md

## Hyperedges (group relationships)

- **Bitfocus Companion Core Maintainer Review/Governance Process** — copilot_instructions_doc, git_commit_instructions_doc, pull_request_template_doc, companion_release_checklist_doc [INFERRED 0.80]
- **Superrack Router HTTP UI Navigation Flow** — home_html, rack_channel_html, midi_plugin_html, midi_snapshot_html [EXTRACTED 0.90]
- **Test, Build and Release Pipeline** — pr_unit_test_workflow, release_on_version_change_workflow, package_json, manifest_json [EXTRACTED 0.85]

## Communities

### Community 0 - "ModuleInstance Core (Companion Lifecycle)"

Cohesion: 0.14
Nodes (4): ModuleInstance, UpdateActions, UpdateFeedbacks, UpdateVariableDefinitions

### Community 1 - "Patch UI Frontend (app.js)"

Cohesion: 0.10
Nodes (17): 161791c feat: reorder plugin and snapshot step execution for improved processing, 21b0865 chore: bump version to 0.3.0 in manifest and package files, 269a00c feat: add MIDI sequence retrieval for snapshots and plugins, refactor execution logic, 2fa3f6d feat: add home navigation button to mapping UIs and implement home page with grid layout, 376bcc0 feat: refactor MIDI mapping logic and streamline rack sequence execution, 4d37311 feat: update patch routes to serve rack-channel UI and add test route for home page, 4f6795d feat: add hotMap default mapping and expose in main module, 8d6c0a8 feat: enhance MIDI step execution with configurable delays and update timestamp handling (+9 more)

### Community 2 - "Module Wiring (main/actions/feedbacks/variables)"

Cohesion: 0.14
Nodes (17): resolveRackForChannel(), \_findPortIndexByName(), handleIncomingMidi(), \_isEcho(), midiConfigSnapshot(), midiStepToBytes(), portBaseName(), \_recordSent() (+9 more)

### Community 3 - "Docs & Governance (README/CHANGELOG/Checklists)"

Cohesion: 0.11
Nodes (19): cellRefs, clearAllMappings(), clearBtn, exportBtn, homeBtn, importBtn, importInput, loadBtn (+11 more)

### Community 4 - "MIDI Map Parsing & Validation"

Cohesion: 0.23
Nodes (17): micha/midi-connector, 0ed48f7 feat: add unit tests for MIDI channel validation to prevent conflicts, 1fb4722 feat: bump version to 0.4.0 for release, 2462196 feat: bump version to 0.3.3 for release, 27689b3 feat: add trigger channel configuration with routing logic for racks, 409df04 feat: remove display none from custom alert for improved visibility, 60d6da1 feat: bump version to 0.3.1 for release, 6a7d2bb feat: add unit tests for ModuleInstance core logic and export the module (+9 more)

### Community 5 - "HTTP Server Integration Tests"

Cohesion: 0.22
Nodes (10): { resolveRackForChannel }, 0ad74fb chore: bump version to 0.4.3 in manifest and package files, 2dfd012 fix: replace log calls with \_log for consistent logging format, 30d4a57 fix: mapping matrix working logging functions added, 45d7ed9 undo: changes in yarn.lock, 5d23617 feat: update channel input to use number type with validation and tooltip, 6fe4f5d chore: bump version to 0.4.7 in manifest and package files, 7f4fc5d feat: update channel input to accept variable strings with improved validation and tooltip (+2 more)

### Community 6 - "MIDI Plugin Frontend (midi.js)"

Cohesion: 0.29
Nodes (6): applyMidiStepToVariables(), parseMidiMapString(), validateRackMidiMap(), { validateRackMidiMap, parseMidiMapString }, { validateRackMidiMap, parseMidiMapString }, { applyMidiStepToVariables }

### Community 7 - "HTTP Server Unit Tests"

Cohesion: 0.18
Nodes (6): request, { startHttpServer, stopHttpServer }, request, { startHttpServer, stopHttpServer }, fastifyFactory, fastifyStatic

### Community 8 - "Default Config & Hot Maps"

Cohesion: 0.25
Nodes (9): 0733dc7 Use immutable yarn install in PR unit test workflow, 28e4869 Add Graphify architecture graph for orientation, 699284b Update release workflow triggers and add PR reviewer test workflow, 731e887 Merge pull request #3 from Schaack-Jan/codex/update-github-workflow-for-main-branch, 75e8971 Fix unit tests by mocking Companion entrypoint in test scope, c668c0d Merge pull request #2 from Schaack-Jan/fix/mapping-not-working, cf28de7 feat: optional native MIDI ports via @julusian/midi (plan waves W1+W2), d074fad docs: add MIDI integration research and implementation plan (+1 more)

### Community 9 - "HTTP UI Pages (static HTML)"

Cohesion: 0.25
Nodes (8): 090aa6f chore: rename companion-module-checks.yaml to companion-module-checks.yaml.inactive, 3dafcdb chore: bump version to 0.4.4 in manifest and package files, 47e7b12 fix: update close button hover style for improved visibility, 94bbd41 docs: add Waves configuration instructions for MIDI rack selection workaround, ad128c2 feat: add GitHub Actions workflows for automated build and release on version change, ba05dbb feat: enhance alert system with close button and improved styling, d0626f3 fix: adjust z-index values for alert container and custom alerts, dcbcb42 chore: bump version to 0.4.5 in manifest and package files

### Community 10 - "Community 10"

Cohesion: 0.33
Nodes (6): Bitfocus Companion Module Release Checklist, GitHub Copilot Instructions (Bitfocus Companion Module v4+), Pre-Commit / CI Review Prompt, Waves SuperRack Router Inline Help, Companion Module Review (Core) PR Template, README.md (Waves SuperRack Router Companion Module)

### Community 11 - "Community 11"

Cohesion: 0.33
Nodes (6): 21db6df chore: update CI workflow to enable Corepack for Yarn v4 and improve dependency installation, 2fff2ec chore: removed unit test, 3307ead chore: removed unused action, d9206be chore: bump version to 0.4.6.4 in manifest and package files, e958a2d chore: bump version to 0.4.6.3 in manifest and package files, e97a1f7 chore: bump version to 0.4.6.5 in manifest and package files, update GitHub Actions to use GH_PAT for authentication

### Community 12 - "Community 12"

Cohesion: 0.40
Nodes (4): channelInput, sendToServer(), typeSelect, updateMidiSetting()

### Community 13 - "Community 13"

Cohesion: 0.40
Nodes (4): buildServer(), fastifyFactory, fastifyStatic, request

### Community 14 - "Community 14"

Cohesion: 0.33
Nodes (1): MockPort

### Community 15 - "Community 15"

Cohesion: 0.40
Nodes (5): 03835ec chore: replace npm with yarn for dependency installation in CI workflow, 6e3ab80 chore: install Yarn v4 in CI workflow for dependency management, 8b89220 chore: replace npm with yarn for dependency installation in CI workflow, c649e7d chore: bump version to 0.4.6 in manifest and package files, d9a4cda chore: install Yarn v4 in CI workflow for dependency management

## Knowledge Gaps

- **37 isolated node(s):** `midiMock`, `{
	startMidiService,
	stopMidiService,
	sendMidiStep,
	midiStepToBytes,
	resolveBackend,
	midiConfigSnapshot,
	ECHO_SUPPRESS_MS,
}`, `{ resolveRackForChannel }`, `{ resolveRackForChannel }`, `{ InstanceBase, runEntrypoint, InstanceStatus }` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 14`** (1 nodes): `MockPort`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `ModuleInstance` connect `ModuleInstance Core (Companion Lifecycle)` to `Patch UI Frontend (app.js)`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `MockPort` connect `Community 14` to `Module Wiring (main/actions/feedbacks/variables)`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `startMidiService()` connect `Module Wiring (main/actions/feedbacks/variables)` to `Patch UI Frontend (app.js)`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `midiMock`, `{
	startMidiService,
	stopMidiService,
	sendMidiStep,
	midiStepToBytes,
	resolveBackend,
	midiConfigSnapshot,
	ECHO_SUPPRESS_MS,
}`, `{ resolveRackForChannel }` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ModuleInstance Core (Companion Lifecycle)` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Should `Patch UI Frontend (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Module Wiring (main/actions/feedbacks/variables)` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._
