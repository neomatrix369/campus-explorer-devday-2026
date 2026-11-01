import AppKit
import AVFoundation

/// Sliced sprite frames for one pet definition, shared by every window showing that pet.
final class SpriteSheet {
    let frames: [CGImage]
    /// Unscaled frame size in points.
    let frameWidth: Int
    let frameHeight: Int
    let icon: NSImage?

    init(pet: PetDefinition) throws {
        guard let source = NSImage(data: pet.pngData),
              let cg = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw PetXMLError.missing("image/png (undecodable)")
        }
        let w = cg.width / pet.tilesX
        let h = cg.height / pet.tilesY
        frameWidth = w
        frameHeight = h
        var list: [CGImage] = []
        list.reserveCapacity(pet.tilesX * pet.tilesY)
        for row in 0..<pet.tilesY {
            for col in 0..<pet.tilesX {
                let rect = CGRect(x: col * w, y: row * h, width: w, height: h)
                if let f = cg.cropping(to: rect) { list.append(f) }
            }
        }
        frames = list
        if let d = pet.iconData, let img = NSImage(data: d) {
            icon = img
        } else {
            icon = nil
        }
    }

    func frame(_ index: Int) -> CGImage? {
        guard !frames.isEmpty else { return nil }
        return frames[min(max(index, 0), frames.count - 1)]
    }
}

/// Plays the base64 MP3 sounds attached to animations (replaces NAudio).
final class SoundPlayer: NSObject, AVAudioPlayerDelegate {
    static let shared = SoundPlayer()
    var volume: Float = 0.5
    var enabled = true
    private var players: [ObjectIdentifier: AVAudioPlayer] = [:]

    func sing() -> Void {
        play(PetSound(animationID: 0, probability: 100, loop: 0, data: Self.songData()))
    }

    private static func songData() -> Data {
        let sampleRate = 22_050
        let noteSeconds = 0.23
        let notes = [392.0, 440.0, 523.25, 440.0, 392.0, 329.63, 392.0]
        let samplesPerNote = Int(Double(sampleRate) * noteSeconds)
        let sampleCount = samplesPerNote * notes.count
        var wav = Data()
        func appendLittleEndian<T: FixedWidthInteger>(_ value: T) {
            Swift.withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) }
        }
        wav.append(contentsOf: "RIFF".utf8)
        appendLittleEndian(UInt32(36 + sampleCount * 2))
        wav.append(contentsOf: "WAVEfmt ".utf8)
        appendLittleEndian(UInt32(16))
        appendLittleEndian(UInt16(1))
        appendLittleEndian(UInt16(1))
        appendLittleEndian(UInt32(sampleRate))
        appendLittleEndian(UInt32(sampleRate * 2))
        appendLittleEndian(UInt16(2))
        appendLittleEndian(UInt16(16))
        wav.append(contentsOf: "data".utf8)
        appendLittleEndian(UInt32(sampleCount * 2))
        for index in 0..<sampleCount {
            let noteIndex = index / samplesPerNote
            let localTime = Double(index % samplesPerNote) / Double(sampleRate)
            let envelope = max(0, min(1, localTime / 0.025, (noteSeconds - localTime) / 0.05))
            let tone = sin(2 * Double.pi * notes[noteIndex] * localTime) * envelope * 0.32
            appendLittleEndian(Int16(tone * Double(Int16.max)))
        }
        return wav
    }

    func play(_ sound: PetSound) {
        guard enabled, volume > 0 else { return }
        do {
            let p = try AVAudioPlayer(data: sound.data)
            p.volume = volume
            p.numberOfLoops = max(0, sound.loop)
            p.delegate = self
            players[ObjectIdentifier(p)] = p
            p.play()
        } catch {
            NSLog("DesktopPet: cannot play sound: \(error)")
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        players.removeValue(forKey: ObjectIdentifier(player))
    }
}
