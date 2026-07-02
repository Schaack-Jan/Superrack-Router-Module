# SuperRackMidiHelper (Windows MIDI Services virtual device)

Small C# console app that registers a **virtual MIDI device** ("SuperRack Router")
via [Windows MIDI Services](https://microsoft.github.io/MIDI/) and bridges it to
the Companion module over stdio (newline-delimited JSON). This removes the need
for loopMIDI on **Windows 11 24H2 or newer**.

Status: **experimental** — build in CI, verify on a real Windows 11 24H2+ machine.

## Requirements (runtime)

- Windows 11 24H2 or newer with the Windows MIDI Services rollout applied
- The Windows MIDI Services **SDK runtime** installed (https://aka.ms/midi)

## Build

The SDK NuGet package is only distributed via GitHub releases, not nuget.org:

```powershell
# 1. download the SDK package into helper/packages
gh release download --repo microsoft/MIDI --pattern 'Microsoft.Windows.Devices.Midi2*.nupkg' --dir helper/packages

# 2. publish a single-file executable
dotnet publish helper/SuperRackMidiHelper -c Release -r win-x64 -o helper/dist/win-x64
```

Or run the GitHub Actions workflow `build-midi-helper.yaml` (windows runner) and
download the artifact.

## Install

Copy `SuperRackMidiHelper.exe` next to the module (default lookup path
`helper/dist/win-x64/SuperRackMidiHelper.exe`) **or** set the full path in the
module config field "Windows MIDI helper path". If the helper is missing or
fails, the module automatically falls back to the loopMIDI-based backend.

## Protocol

```
helper -> node: {"type":"ready","endpointId":"..."}
                {"type":"midi","bytes":[176,1,5]}
                {"type":"log","level":"info","message":"..."}
                {"type":"error","message":"..."}
node -> helper: {"type":"send","bytes":[176,1,5]}
                {"type":"quit"}
```
