import Speech
import AVFoundation

class WakeWordDetector {
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private let engine = AVAudioEngine()
  private var lastTriggerDate: Date?
  private let cooldown: TimeInterval = 1800 // 30-minute cooldown per spec

  var onDetected: (() -> Void)?

  func start() {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else { return }
      self.recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
      self.recognizer?.supportsOnDeviceRecognition = true
      self.beginListening()
    }
  }

  private func beginListening() {
    request = SFSpeechAudioBufferRecognitionRequest()
    request?.requiresOnDeviceRecognition = true
    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    try? engine.start()
    task = recognizer?.recognitionTask(with: request!) { [weak self] result, error in
      if let text = result?.bestTranscription.formattedString.lowercased(), text.contains("hey dreamlog") {
        self?.handleWakeWord()
      }
      if error != nil { self?.stop(); self?.beginListening() }
    }
  }

  private func handleWakeWord() {
    let now = Date()
    if let last = lastTriggerDate, now.timeIntervalSince(last) < cooldown { return }
    lastTriggerDate = now
    onDetected?()
  }

  func stop() {
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    task?.cancel(); task = nil; request = nil
  }
}
