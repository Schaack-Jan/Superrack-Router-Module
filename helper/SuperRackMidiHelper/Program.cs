// SuperRackMidiHelper — Windows MIDI Services virtual device bridge.
//
// Creates a virtual UMP endpoint ("virtual device app") via the Windows MIDI
// Services App SDK so the SuperRack Router Companion module appears as a real
// MIDI device to every host on Windows 11 24H2+ (WinMM MIDI 1.0 hosts included,
// via the service's automatic translation).
//
// Talks to the parent Node.js process over stdio using newline-delimited JSON:
//   helper -> node: {"type":"ready","endpointId":"..."}
//                   {"type":"midi","bytes":[176,1,5]}
//                   {"type":"log","level":"info","message":"..."}
//                   {"type":"error","message":"..."}
//   node -> helper: {"type":"send","bytes":[176,1,5]}
//                   {"type":"quit"}
//
// Usage: SuperRackMidiHelper.exe --name "SuperRack Router"

using System.Text.Json;
using Microsoft.Windows.Devices.Midi2;
using Microsoft.Windows.Devices.Midi2.Endpoints.Virtual;
using Microsoft.Windows.Devices.Midi2.Initialization;

internal static class Program
{
    private static readonly object OutLock = new();

    private static void Emit(object payload)
    {
        lock (OutLock)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(payload));
            Console.Out.Flush();
        }
    }

    private static void Log(string level, string message) => Emit(new { type = "log", level, message });

    private static int Main(string[] args)
    {
        var name = "SuperRack Router";
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--name") name = args[i + 1];
        }

        using var initializer = MidiDesktopAppSdkInitializer.Create();
        if (initializer == null || !initializer.InitializeSdkRuntime())
        {
            Emit(new { type = "error", message = "Windows MIDI Services SDK runtime not found. Install it from https://aka.ms/midi (requires Windows 11 24H2+)." });
            return 2;
        }
        if (!initializer.EnsureServiceAvailable())
        {
            Emit(new { type = "error", message = "Windows MIDI Service is not available on this system." });
            return 3;
        }

        var session = MidiSession.Create($"{name} Helper");
        if (session == null)
        {
            Emit(new { type = "error", message = "Could not create MIDI session." });
            return 4;
        }

        var endpointInfo = new MidiDeclaredEndpointInfo
        {
            Name = name,
            ProductInstanceId = "SUPERRACKROUTER1",
            SpecificationVersionMajor = 1,
            SpecificationVersionMinor = 1,
            SupportsMidi10Protocol = true,
            SupportsMidi20Protocol = false,
            SupportsReceivingJitterReductionTimestamps = false,
            SupportsSendingJitterReductionTimestamps = false,
            HasStaticFunctionBlocks = true,
        };

        var deviceIdentity = new MidiDeclaredDeviceIdentity();

        var userInfo = new MidiEndpointUserSuppliedInfo
        {
            Name = name,
            Description = "Waves SuperRack Router Companion module",
        };

        var creationConfig = new MidiVirtualDeviceCreationConfig(
            name,
            "Virtual MIDI device of the SuperRack Router Companion module",
            "Superrack Router Module",
            endpointInfo,
            deviceIdentity,
            userInfo);

        var functionBlock = new MidiFunctionBlock
        {
            Number = 0,
            Name = name,
            IsActive = true,
            Direction = MidiFunctionBlockDirection.Bidirectional,
            UIHint = MidiFunctionBlockUIHint.Bidirectional,
            FirstGroup = new MidiGroup(0),
            GroupCount = 1,
            RepresentsMidi10Connection = MidiFunctionBlockRepresentsMidi10Connection.YesBandwidthUnrestricted,
            MaxSystemExclusive8Streams = 0,
            MidiCIMessageVersionFormat = 0,
        };
        creationConfig.FunctionBlocks.Add(functionBlock);

        var virtualDevice = MidiVirtualDeviceManager.CreateVirtualDevice(creationConfig);
        if (virtualDevice == null)
        {
            Emit(new { type = "error", message = "Could not create virtual MIDI device endpoint." });
            return 5;
        }

        var connection = session.CreateEndpointConnection(virtualDevice.DeviceEndpointDeviceId);
        if (connection == null)
        {
            Emit(new { type = "error", message = "Could not open a connection to the virtual device endpoint." });
            return 6;
        }

        connection.AddMessageProcessingPlugin(virtualDevice);

        virtualDevice.StreamConfigRequestReceived += (_, _) => Log("debug", "Stream configuration request received");

        connection.MessageReceived += (_, midiArgs) =>
        {
            var packet = midiArgs.GetMessagePacket();
            if (packet.PacketType != MidiPacketType.UniversalMidiPacket32) return;
            var word = ((MidiMessage32)packet).Word0;
            // Only MIDI 1.0 channel voice messages (UMP message type 0x2) are bridged.
            if ((word >> 28) != 0x2) return;
            var status = (byte)((word >> 16) & 0xff);
            var data1 = (byte)((word >> 8) & 0x7f);
            var data2 = (byte)(word & 0x7f);
            Emit(new { type = "midi", bytes = new int[] { status, data1, data2 } });
        };

        if (!connection.Open())
        {
            Emit(new { type = "error", message = "Endpoint connection could not be opened." });
            return 7;
        }

        Emit(new { type = "ready", endpointId = virtualDevice.DeviceEndpointDeviceId });
        Log("info", $"Virtual MIDI device \"{name}\" is online.");

        string? line;
        while ((line = Console.In.ReadLine()) != null)
        {
            try
            {
                using var doc = JsonDocument.Parse(line);
                var type = doc.RootElement.GetProperty("type").GetString();
                if (type == "quit") break;
                if (type != "send") continue;

                var bytesElement = doc.RootElement.GetProperty("bytes");
                var bytes = new byte[bytesElement.GetArrayLength()];
                var idx = 0;
                foreach (var b in bytesElement.EnumerateArray()) bytes[idx++] = (byte)b.GetInt32();
                if (bytes.Length < 2) continue;

                // Pack classic MIDI 1.0 bytes into a UMP MT2 (MIDI 1.0 channel voice) word, group 0.
                var word = ((uint)0x2 << 28)
                    | ((uint)bytes[0] << 16)
                    | ((uint)bytes[1] << 8)
                    | (bytes.Length > 2 ? bytes[2] : 0u);
                // Timestamp 0 = send immediately (MidiClock.TimestampConstantSendImmediately)
                var message = new MidiMessage32(0, word);
                connection.SendSingleMessagePacket(message);
            }
            catch (Exception ex)
            {
                Log("warn", $"Ignoring malformed command line: {ex.Message}");
            }
        }

        session.DisconnectEndpointConnection(connection.ConnectionId);
        session.Dispose();
        Log("info", "Helper shut down.");
        return 0;
    }
}
