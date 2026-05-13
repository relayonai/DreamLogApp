import ExpoModulesCore
import AVFoundation
import ActivityKit
import UserNotifications
import WatchConnectivity

public class DreamLogRecorderModule: Module, WCSessionDelegate {
  private var audioRecorder: AVAudioRecorder?
  private var recordingURL: URL?
  private var liveActivity: AnyObject?  // Activity<RecordingAttributes>? — typed as AnyObject for iOS version compatibility

  public func definition() -> ModuleDefinition {
    Name("DreamLogRecorder")

    OnCreate {
      if WCSession.isSupported() {
        WCSession.default.delegate = self
        WCSession.default.activate()
      }
    }

    AsyncFunction("startRecording") { (promise: Promise) in
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(.record, mode: .default)
        try session.setActive(true)
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = docs.appendingPathComponent("dream-\(Int(Date().timeIntervalSince1970)).m4a")
        self.recordingURL = url
        let settings: [String: Any] = [
          AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
          AVSampleRateKey: 44100,
          AVNumberOfChannelsKey: 1,
          AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        self.audioRecorder = try AVAudioRecorder(url: url, settings: settings)
        self.audioRecorder?.record()

        if #available(iOS 16.2, *) {
          let attrs = RecordingAttributes()
          let state = RecordingAttributes.ContentState(elapsedSeconds: 0)
          let content = ActivityContent(state: state, staleDate: nil)
          self.liveActivity = try? Activity<RecordingAttributes>.request(attributes: attrs, content: content)

          Task {
            var seconds = 0
            while self.audioRecorder != nil {
              try? await Task.sleep(nanoseconds: 1_000_000_000)
              seconds += 1
              let newState = RecordingAttributes.ContentState(elapsedSeconds: seconds)
              if let activity = self.liveActivity as? Activity<RecordingAttributes> {
                await activity.update(ActivityContent(state: newState, staleDate: nil))
              }
            }
          }
        }

        promise.resolve(url.absoluteString)
      } catch { promise.reject("RECORD_ERROR", error.localizedDescription) }
    }

    AsyncFunction("stopRecording") { (promise: Promise) in
      guard let recorder = self.audioRecorder, let url = self.recordingURL else {
        promise.reject("NO_RECORDING", "No active recording"); return
      }
      recorder.stop(); self.audioRecorder = nil

      if #available(iOS 16.2, *) {
        if let activity = self.liveActivity as? Activity<RecordingAttributes> {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
        self.liveActivity = nil
      }

      promise.resolve(url.absoluteString)
    }

    AsyncFunction("scheduleWakeWindow") { (startHour: Int, startMinute: Int, promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
        guard granted else { promise.reject("PERMISSION_DENIED", "Notification permission denied"); return }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["dreamlog.wake.start"])
        let content = UNMutableNotificationContent()
        content.title = "Time to capture your dream"
        content.body = "Tap to record before it fades"
        content.sound = .default
        content.userInfo = ["url": "dreamlog://record"]
        var components = DateComponents()
        components.hour = startHour; components.minute = startMinute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: "dreamlog.wake.start", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { err in
          if let err = err { promise.reject("SCHEDULE_ERROR", err.localizedDescription) }
          else { promise.resolve(nil) }
        }
      }
    }

    AsyncFunction("cancelWakeWindow") { (promise: Promise) in
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["dreamlog.wake.start"])
      promise.resolve(nil)
    }
  }

  public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if message["event"] as? String == "rem_exit" {
      NotificationCenter.default.post(name: NSNotification.Name("REMExitDetected"), object: nil)
    }
  }
  public func sessionDidBecomeInactive(_ session: WCSession) {}
  public func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
  public func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
}
