import SwiftUI

@main
struct DreamLogWatchApp: App {
  private let detector = REMDetector()
  init() { detector.start() }
  var body: some Scene {
    WindowGroup {
      VStack {
        Image(systemName: "moon.zzz.fill").foregroundColor(.purple).font(.largeTitle)
        Text("DreamLog").font(.headline)
        Text("Monitoring sleep…").font(.caption).foregroundColor(.gray)
      }
    }
  }
}
