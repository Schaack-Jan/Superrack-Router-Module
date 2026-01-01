# Waves SuperRack Router – Inline Help

## Overview

This module routes WING sources to Waves SuperRack racks using predefined MIDI sequences. It does **not** open its own MIDI connection. Instead, it exposes variables for use with a Generic-MIDI instance.

---

## Prerequisites

- A connection to your mixing console that can output the selected channel as an **integer** (INT)
- A **Generic-MIDI** connection that is integrated with Waves SuperRack

---

## How to Use

1. **Add this module in Companion v4.**
2. **Configure:**
   - Log level
   - Rack count (4/8/16/32/64)
   - Channel count (min 32, max 512)
   - HTTP port (for the UI)
   - Paste your SuperRack MIDI Map (JSON)
3. **Add a Generic-MIDI instance** and connect it to Waves SuperRack.
4. **Set up triggers:**
   - **Trigger 1:** On channel change from your mixing console, send the INT value to the `superrack-router` `trigger_channel_action`.
   - **Trigger 2:** On every change of `$(superrack-router:last_action_timestamp)`, send a MIDI message on the Generic-MIDI connection using the variables provided by this module (`midi_last_channel`, `midi_last_controller`, `midi_last_value`, etc.).

---

## Waves Configuration

Waves does not natively support selecting racks via MIDI. Therefore, a workaround is required:

- For **Rack 1**, set a plugin from Rack 1 as a Hot Plugin. Repeat this for each rack.
- If all Hot Plugins are already assigned, create a **Snapshot** that only stores the Hot Plugins.
- Save this Snapshot as a **Hot Snapshot**.

Once all Hot Snapshots and Hot Plugins exist, configure the MIDI settings:

- Use the helper buttons **"route single Hot Snapshot"** and **"route single Hot Plugin"** to assign MIDI calls.
- When all Hot Snapshots and Hot Plugins can be triggered via MIDI, you can proceed to map the racks to the channel ID in the connection.

---

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

---

## Example: Using with Generic-MIDI

Set up triggers in Companion:

- **Trigger 1:** When the selected channel changes on your mixing console, send the INT value to the `superrack-router` trigger channel action.
- **Trigger 2:** When `$(superrack-router:last_action_timestamp)` changes, send a MIDI CC message with:
  - Channel: `$(superrack-router:midi_last_channel)`
  - Controller: `$(superrack-router:midi_last_controller)`
  - Value: `$(superrack-router:midi_last_value)`
- Make sure "Use Variables" is enabled in the Generic-MIDI action.

---

## Hot Snapshots & Hot Plugins

- Hot Snapshots (IDs 1–6) and Hot Plugins (IDs 1–12) must be defined in your MIDI Map JSON as collections or arrays.
- If a sequence is missing, the action will log a warning and do nothing (no error thrown).

---

## HTTP UI

- The UI is served from `/` on the configured port.
- Endpoints: `/`, `/patch`, `/patch/`, `/health`, `/patch/mappings`, `/patch/update`, `/rack/:id`
- Example: `http://localhost:8010/`

---

## Troubleshooting

- If the UI does not load, check the configured HTTP port and ensure no other process is using it.
- No internal MIDI connection is opened; all MIDI is sent via variables to a Generic-MIDI instance.

---

## Maintainer Notes

- This module uses the Companion v4 Node runtime (`node22`, `nodejs-ipc`). No own IPC is required.
- Build artifacts and non-source UI are excluded from the repository.

---

For more details, see the README or contact the maintainers.
