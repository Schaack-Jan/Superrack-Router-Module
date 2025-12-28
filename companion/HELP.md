# Waves SuperRack Router – Inline Help

## Overview
This module routes WING sources to Waves SuperRack racks using predefined MIDI sequences. It does not open its own MIDI connection. Instead, it exposes variables for use with a Generic-MIDI instance.

## Setup
1. Add this module in Companion v4.
2. Configure:
   - Log level
   - Rack count (4/8/16/32/64)
   - Channel count (min 32, max 512)
   - HTTP port (for the UI)
   - Paste your SuperRack MIDI Map (JSON)
3. Add a Generic-MIDI instance and use its actions (e.g., send CC) with the variables from this module.

## Actions
- **Route Rack**: Triggers the MIDI sequence for a specific rack.
- **Route Hot Snapshot**: Triggers the MIDI sequence for a Hot Snapshot (IDs 1–6).
- **Route Hot Plugin**: Triggers the MIDI sequence for a Hot Plugin (IDs 1–12).

## Feedbacks
- **active_source**: True if the given source index is currently active.
- **rack_last_used**: True if the given rack was last routed.
- **sequence_running**: True while a routing sequence is running.

## Variables
- `last_routed_racks`: JSON array of recently routed rack IDs
- `last_action_timestamp`: Timestamp (ms) of the last routing action
- `failed_steps_total`: Total number of failed MIDI steps
- `midi_last_type`: Last MIDI type (cc, noteon, program)
- `midi_last_channel`: Last MIDI channel
- `midi_last_controller`: Last MIDI controller/note/program
- `midi_last_value`: Last MIDI value
- `active_source_index`: Currently active source index (if used)
- `active_source_label`: Currently active source label (if used)

## Example: Using with Generic-MIDI
Set up a trigger in Companion:
- When `$(superrack-router:last_action_timestamp)` changes,
- Send a MIDI CC message with:
  - Channel: `$(superrack-router:midi_last_channel)`
  - Controller: `$(superrack-router:midi_last_controller)`
  - Value: `$(superrack-router:midi_last_value)`
- Make sure "Use Variables" is enabled in the Generic-MIDI action.

## Hot Snapshots & Hot Plugins
- Hot Snapshots (IDs 1–6) and Hot Plugins (IDs 1–12) must be defined in your MIDI Map JSON as collections or arrays.
- If a sequence is missing, the action will log a warning and do nothing (no error thrown).

## HTTP UI
- The UI is served from `/patch` on the configured port.
- Endpoints: `/`, `/patch`, `/patch/`, `/health`, `/patch/mappings`, `/patch/update`, `/rack/:id`
- Example: `http://localhost:12345/patch`

## MIDI Map JSON Structure
- Example:
```json
{
  "racks": {
    "1": { "name": "Rack 1", "enabled": true, "midiSteps": [ { "type": "cc", "channel": 1, "controller": 12, "value": 100, "delay": 0 } ] },
    "2": { "name": "Rack 2", "enabled": true, "midiSteps": [ { "type": "noteon", "channel": 1, "note": 60, "value": 127, "delay": 1 } ] }
  },
  "hotSnapshots": {
    "1": [ { "type": "program", "channel": 1, "program": 10, "delay": 0 } ]
  },
  "hotPlugins": {
    "1": [ { "type": "cc", "channel": 2, "controller": 7, "value": 64, "delay": 0 } ]
  }
}
```
- Each step: `{ type: 'cc'|'noteon'|'program', channel: 1-16, delay: >=0, ... }`

## Troubleshooting
- If the UI does not load, check the configured HTTP port and ensure no other process is using it.
- If routing actions do not work, check your MIDI Map JSON and logs for warnings.
- No internal MIDI connection is opened; all MIDI is sent via variables to a Generic-MIDI instance.

## Maintainer Notes
- This module uses the Companion v4 Node runtime (`node22`, `nodejs-ipc`). No own IPC is required.
- Build artifacts and non-source UI are excluded from the repository.

---
For more details, see the README or contact the maintainers.
