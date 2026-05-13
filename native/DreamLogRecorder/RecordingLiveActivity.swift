import ActivityKit
import SwiftUI

struct RecordingAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var elapsedSeconds: Int
  }
}

struct RecordingLiveActivityView: View {
  let context: ActivityViewContext<RecordingAttributes>
  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "waveform").foregroundColor(.purple)
      Text("\(context.state.elapsedSeconds)s").monospacedDigit().foregroundColor(.white)
      Spacer()
      Link(destination: URL(string: "dreamlog://stop")!) {
        Label("Stop", systemImage: "stop.fill").foregroundColor(.red)
      }
    }.padding()
  }
}
