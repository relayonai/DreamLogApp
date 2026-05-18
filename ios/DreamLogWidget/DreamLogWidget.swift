import WidgetKit
import SwiftUI

struct DreamLogWidgetEntry: TimelineEntry {
  let date: Date
}

struct DreamLogWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> DreamLogWidgetEntry {
    DreamLogWidgetEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (DreamLogWidgetEntry) -> Void) {
    completion(DreamLogWidgetEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DreamLogWidgetEntry>) -> Void) {
    completion(Timeline(entries: [DreamLogWidgetEntry(date: Date())], policy: .never))
  }
}

struct DreamLogWidgetView: View {
  var entry: DreamLogWidgetEntry
  var body: some View {
    Link(destination: URL(string: "dreamlog://record")!) {
      ZStack {
        Color(red: 0.04, green: 0.04, blue: 0.08)
        VStack(spacing: 4) {
          Image(systemName: "moon.zzz.fill")
            .foregroundColor(Color(red: 0.42, green: 0.39, blue: 1.0))
            .font(.system(size: 20))
          Text("Record")
            .font(.caption2)
            .foregroundColor(.white)
        }
      }
    }
  }
}

@main
struct DreamLogWidget: Widget {
  let kind: String = "DreamLogWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DreamLogWidgetProvider()) { entry in
      DreamLogWidgetView(entry: entry)
    }
    .configurationDisplayName("DreamLog")
    .description("Tap to record a dream")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
