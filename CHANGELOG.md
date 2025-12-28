# Changelog

## [0.2.4] – 2025-12-28

### Added

- Full support for Hot Snapshots (IDs 1–6) and Hot Plugins (IDs 1–12) via MIDI Map JSON.
- Robust HTTP server restart and config reinit (port change, mapping update).
- Complete English documentation (README, HELP).
- New variables: last_routed_racks, failed_steps_total, last_action_timestamp, active_source_index/label.
- Feedbacks: active_source, rack_last_used, sequence_running.

### Changed

- Actions/labels unified: "Route Rack", "Route Hot Snapshot", "Route Hot Plugin".
- Only `ui/public` is the UI source; build artifacts and patch-interface removed from repo.
- Manifest and package.json point to maintainer repo.

### Removed

- Deprecated action "trigger_channel" and all references to rack_channel_index_X.
- All build artifacts and non-source UI from repository.

### Fixed

- Sequence lifecycle, error counter, and variable updates are now robust and consistent.
- HTTP endpoints skip unnecessary config churn if mapping is unchanged.
- Improved error logging and status handling for HTTP server.

---

Older changes omitted for brevity.
