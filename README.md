# Waves SuperRack Router Companion Module

This Companion v4 module routes WING sources to Waves SuperRack racks using predefined MIDI sequences. It does not open its own MIDI connection—instead, it exposes variables that you can trigger via a Generic-MIDI instance.

Overview
- Purpose: Execute rack sequences (CC/NoteOn/Program), trigger Hot Snapshots/Plugins
- UI: A simple patch UI is served via the configurable HTTP port
- Tested with: Bitfocus Companion v4.x, Fastify v5, @fastify/static v8

Setup
1. Start Companion and add this module.
2. In the module settings:
   - Choose log level.
   - Set rack count (4/8/16/32/64).
   - Set channel count (min 32, max 512).
   - Configure the HTTP port (default from the module defaults).
   - Paste the SuperRack MIDI Map (JSON) as a string. The module parses this once and uses `midiMapObj` internally.
3. Additionally, add a Generic-MIDI instance and use its actions (e.g., send CC) with the variables provided by this module.

Variables
- `midi_last_type`, `midi_last_channel`, `midi_last_controller`, `midi_last_value`
- `last_action_timestamp`
- `active_source_index`, `active_source_label`
- `last_routed_racks`
- `failed_steps_total`

Actions & Feedbacks
- Actions: Route rack, trigger Hot Snapshot/Plugin.
- Feedbacks: Status/color feedback based on sequence status.

HTTP Routepatch UI
- Endpoints: `/`, `/patch`, `/patch/`, `/health`, `/patch/mappings`, `/patch/update`, `/rack/:id`
- The port is configurable; for example, open `http://<your-host>:<port>/patch`.

Notes on the MIDI Map JSON
- Expected structure: `{ racks: { "1": { name: string, enabled: boolean, midiSteps: Step[] }, ... } }`
- Step: `{ type: 'cc'|'noteon'|'program', channel: 1-16, delay: >=0, ... }`
- Validation is performed when loading. On errors, a warning is logged and the module falls back to `{ racks: {} }`.

Development
- Node engine: >=18 <23
- Dependencies: `@companion-module/base`, `fastify`, `@fastify/static`
- Build: `yarn package` (or based on your environment). Prettier is configured.
- Minimal unit tests for `_validateRackMidiMap` and `_loadAllJsonFromConfig` can be added if a test framework is available.

License
- MIT
