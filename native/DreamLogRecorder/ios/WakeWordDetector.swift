import Speech
import AVFoundation

class WakeWordDetector {
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var engine: AVAudioEngine = AVAudioEngine()
  private var lastTriggerDate: Date?
  private let cooldown: TimeInterval = 1800 // 30-minute cooldown per spec
  private var isStopped = false

  var onDetected: (() -> Void)?

  func start() {
    SFSpeechRecognizer.requestAuthorization { [weak self] status in
      guard status == .authorized else { return }
      self?.recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
      self?.recognizer?.supportsOnDeviceRecognition = true
      self?.beginListening()
    }
  }

  private func beginListening() {
    guard !isStopped else { return }
    // Recreate engine each session to avoid tap accumulation from prior install
    engine = AVAudioEngine()
    request = SFSpeechAudioBufferRecognitionRequest()
    request?.requiresOnDeviceRecognition = true
    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    do {
      try engine.start()
    } catch {
      // Engine failed to start; retry with backoff rather than spinning
      scheduleRestart()
      return
    }
    task = recognizer?.recognitionTask(with: request!) { [weak self] result, error in
      if let text = result?.bestTranscription.formattedString.lowercased(), text.contains("hey dreamlog") {
        self?.handleWakeWord()
      }
      if error != nil {
        self?.stopEngine()
        self?.scheduleRestart()
      }
    }
  }

  private func scheduleRestart() {
    guard !isStopped else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
      self?.beginListening()
    }
  }

  private func handleWakeWord() {
    let now = Date()
    if let last = lastTriggerDate, now.timeIntervalSince(last) < cooldown { return }
    lastTriggerDate = now
    onDetected?()
  }

  private func stopEngine() {
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    task?.cancel(); task = nil; request = nil
  }

  func stop() {
    isStopped = true
    stopEngine()
  }
}
