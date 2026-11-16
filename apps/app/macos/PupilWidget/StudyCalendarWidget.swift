import Foundation
import SwiftUI
import WidgetKit

private struct StudySnapshot: Decodable {
    let studyDays: [String]
    let globalStreak: Int
}

private struct StudyEntry: TimelineEntry {
    let date: Date
    let snapshot: StudySnapshot?
}

private struct StudyProvider: TimelineProvider {
    func placeholder(in context: Context) -> StudyEntry {
        StudyEntry(date: .now, snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        completion(StudyEntry(date: .now, snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StudyEntry>) -> Void) {
        let now = Date()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [StudyEntry(date: now, snapshot: loadSnapshot())], policy: .after(next)))
    }

    private func loadSnapshot() -> StudySnapshot? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "PupilAppGroup") as? String,
              let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
              let data = try? Data(contentsOf: directory.appendingPathComponent("study-calendar.json"))
        else { return nil }
        return try? JSONDecoder().decode(StudySnapshot.self, from: data)
    }
}

private struct StudyCalendarView: View {
    let entry: StudyEntry
    private let calendar = Calendar.current

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Study calendar").font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 2)
                if let snapshot = entry.snapshot {
                    Text("\(currentStreak(snapshot)) day streak")
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            if let snapshot = entry.snapshot {
                let days = Set(snapshot.studyDays)
                let formatter = dayFormatter()
                let today = calendar.startOfDay(for: entry.date)
                GeometryReader { geometry in
                    // Keep the full seven rows within the space left by the
                    // title and caption, even when the widget is short.
                    let spacing: CGFloat = 3
                    let cellSize = max(0, min(
                        (geometry.size.width - 15 * spacing) / 16,
                        (geometry.size.height - 6 * spacing) / 7
                    ))
                    let columns = Array(repeating: GridItem(.fixed(cellSize), spacing: spacing), count: 16)
                    LazyVGrid(columns: columns, spacing: spacing) {
                        ForEach(0..<112, id: \.self) { index in
                            let offset = 111 - ((index % 16) * 7 + index / 16)
                            let day = calendar.date(byAdding: .day, value: -offset, to: today) ?? today
                            let studied = days.contains(formatter.string(from: day))
                            RoundedRectangle(cornerRadius: 2)
                                .fill(studied ? Color(red: 0.37, green: 0.77, blue: 0.55) : Color.primary.opacity(0.09))
                                .overlay(RoundedRectangle(cornerRadius: 2).stroke(offset == 0 ? Color.green : .clear, lineWidth: 1))
                                .frame(width: cellSize, height: cellSize)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .accessibilityLabel("Study activity over the last 112 days")
                }
                Text("LAST 16 WEEKS").font(.system(size: 8, weight: .medium, design: .monospaced)).foregroundStyle(.secondary)
            } else {
                Spacer(minLength: 0)
                Text("Open Pupil to show your study calendar.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
        }
        .containerBackground(for: .widget) { Color(nsColor: .windowBackgroundColor) }
    }

    private func currentStreak(_ snapshot: StudySnapshot) -> Int {
        guard let latest = snapshot.studyDays.max(),
              let date = dayFormatter().date(from: latest),
              let age = calendar.dateComponents([.day], from: calendar.startOfDay(for: date),
                                                to: calendar.startOfDay(for: entry.date)).day,
              age >= 0 && age <= 1 else { return 0 }
        return snapshot.globalStreak
    }

    private func dayFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }
}

@main
struct StudyCalendarWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.pupil.study-calendar", provider: StudyProvider()) { entry in
            StudyCalendarView(entry: entry)
        }
        .configurationDisplayName("Study calendar")
        .description("See your study activity and current streak.")
        .supportedFamilies([.systemMedium])
    }
}
