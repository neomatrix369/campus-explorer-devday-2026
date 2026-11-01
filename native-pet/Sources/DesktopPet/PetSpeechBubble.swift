import AppKit

private final class CloudView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedWhite: 1, alpha: 0.97).setFill()
        NSBezierPath(roundedRect: NSRect(x: 0, y: 17, width: bounds.width, height: bounds.height - 17), xRadius: 25, yRadius: 25).fill()
        NSBezierPath(ovalIn: NSRect(x: bounds.midX - 10, y: 7, width: 18, height: 18)).fill()
        NSBezierPath(ovalIn: NSRect(x: bounds.midX - 17, y: 0, width: 9, height: 9)).fill()
    }
}

final class PetSpeechBubble {
    private let window: NSWindow
    private let label: NSTextField
    private let voice = NSSpeechSynthesizer()
    private weak var pet: PetWindow?
    private var timer: Timer?
    private var expiresAt = Date.distantPast

    init() {
        let size = NSSize(width: 240, height: 94)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.ignoresMouseEvents = true
        window.level = .statusBar
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isReleasedWhenClosed = false
        let cloud = CloudView(frame: NSRect(origin: .zero, size: size))
        cloud.wantsLayer = true
        label = NSTextField(wrappingLabelWithString: "")
        label.frame = NSRect(x: 15, y: 29, width: 210, height: 46)
        label.alignment = .center
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textColor = NSColor(calibratedRed: 0.22, green: 0.18, blue: 0.31, alpha: 1)
        label.maximumNumberOfLines = 3
        cloud.addSubview(label)
        window.contentView = cloud
    }

    func show(_ text: String, beside pet: PetWindow, speak: Bool = true) {
        self.pet = pet
        label.stringValue = text
        expiresAt = Date().addingTimeInterval(5.5)
        position()
        window.orderFrontRegardless()
        if speak {
            voice.stopSpeaking()
            voice.startSpeaking(text)
        }
        timer?.invalidate()
        let follow = Timer(timeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            if Date() >= self.expiresAt { self.dismiss(); return }
            self.position()
        }
        timer = follow
        RunLoop.main.add(follow, forMode: .common)
    }

    func dismiss() {
        timer?.invalidate()
        timer = nil
        window.orderOut(nil)
        voice.stopSpeaking()
    }

    private func position() {
        guard let pet else { dismiss(); return }
        let visible = pet.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? .zero
        let width = window.frame.width
        let height = window.frame.height
        let x = max(visible.minX, min(visible.maxX - width, pet.frame.midX - width / 2))
        let above = pet.frame.maxY + 8
        let y = above + height <= visible.maxY ? above : pet.frame.minY - height - 8
        window.setFrameOrigin(NSPoint(x: x, y: max(visible.minY, y)))
    }
}
