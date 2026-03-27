import AVFoundation
import Foundation

/// Records audio from the default mic using AVAudioEngine.
/// Writes at hardware format, then converts to 16 kHz mono WAV via afconvert.
/// Controlled via stdin: waits for "stop\n" then writes the final file path to stdout.

class Recorder {
    let engine = AVAudioEngine()
    var outputFile: AVAudioFile?
    var rawURL: URL?
    var finalURL: URL?

    func start() throws {
        let inputNode = engine.inputNode
        let hwFormat = inputNode.outputFormat(forBus: 0)

        let tempDir = FileManager.default.temporaryDirectory
        let uid = ProcessInfo.processInfo.globallyUniqueString
        rawURL = tempDir.appendingPathComponent("vd_raw_\(uid).caf")
        finalURL = tempDir.appendingPathComponent("vd_\(uid).wav")

        outputFile = try AVAudioFile(forWriting: rawURL!, settings: hwFormat.settings)

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: hwFormat) { [weak self] buffer, _ in
            guard let self = self, let file = self.outputFile else { return }
            do {
                try file.write(from: buffer)
            } catch {
                FileHandle.standardError.write("Write error: \(error.localizedDescription)\n".data(using: .utf8)!)
            }
        }

        engine.prepare()
        try engine.start()
        FileHandle.standardError.write("RECORDING\n".data(using: .utf8)!)
    }

    func stop() -> String? {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        outputFile = nil

        guard let rawURL = rawURL, let finalURL = finalURL else { return nil }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/afconvert")
        process.arguments = [
            rawURL.path, finalURL.path,
            "-d", "LEI16", "-f", "WAVE", "-r", "16000", "-c", "1"
        ]

        do {
            try process.run()
            process.waitUntilExit()

            if process.terminationStatus == 0 {
                try? FileManager.default.removeItem(at: rawURL)
                FileHandle.standardError.write("STOPPED\n".data(using: .utf8)!)
                return finalURL.path
            } else {
                FileHandle.standardError.write("afconvert failed with code \(process.terminationStatus)\n".data(using: .utf8)!)
                return nil
            }
        } catch {
            FileHandle.standardError.write("afconvert error: \(error.localizedDescription)\n".data(using: .utf8)!)
            return nil
        }
    }
}

// MARK: - Main

let recorder = Recorder()

do {
    try recorder.start()
} catch {
    FileHandle.standardError.write("ERROR: \(error.localizedDescription)\n".data(using: .utf8)!)
    exit(1)
}

while let line = readLine() {
    if line.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "stop" {
        if let path = recorder.stop() {
            print(path)
            fflush(stdout)
        }
        break
    }
}

exit(0)
