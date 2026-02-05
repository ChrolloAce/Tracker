# Video Snapshots & Growth Graph Guide

How to fetch video snapshots and build the green growth chart in your mobile app.

---

## Why Your Graph is a Flat Line

A flat line means **no snapshots exist** for that video. The graph needs **multiple snapshots** captured over time to show growth.

### How Snapshots Are Created

| Event | Snapshot Type | When |
|-------|--------------|------|
| Video first added | `initial_upload` | Immediately when video is tracked |
| Automatic refresh | `scheduled_refresh` | Every 12 hours by cron job |
| Manual refresh | `manual_refresh` | When user clicks "Refresh" |

**If a video only has 1 snapshot → flat line**
**If a video has 2+ snapshots → growth chart!**

---

## Database Path for Snapshots

```
organizations/{orgId}/projects/{projectId}/videos/{videoId}/snapshots/{snapshotId}
```

### Snapshot Document Structure

```swift
struct VideoSnapshot {
    let id: String
    let videoId: String
    
    // Metrics at this moment
    let views: Int
    let likes: Int
    let comments: Int
    let shares: Int?
    let saves: Int?
    
    // When captured
    let capturedAt: Timestamp
    
    // How it was captured
    let capturedBy: String  // "initial_upload", "manual_refresh", "scheduled_refresh"
    
    // Is this the first snapshot?
    let isInitialSnapshot: Bool?  // true = baseline, false = growth data
}
```

---

## Step 1: Fetch Snapshots

### iOS (Swift)

```swift
func getVideoSnapshots(orgId: String, projectId: String, videoId: String) async throws -> [VideoSnapshot] {
    let snapshot = try await db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .document(videoId)
        .collection("snapshots")
        .order(by: "capturedAt", descending: false)  // Oldest first!
        .getDocuments()
    
    return snapshot.documents.compactMap { doc in
        try? doc.data(as: VideoSnapshot.self)
    }
}
```

### Android (Kotlin)

```kotlin
suspend fun getVideoSnapshots(orgId: String, projectId: String, videoId: String): List<VideoSnapshot> {
    val snapshot = db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .document(videoId)
        .collection("snapshots")
        .orderBy("capturedAt", Query.Direction.ASCENDING)  // Oldest first!
        .get()
        .await()
    
    return snapshot.documents.mapNotNull { doc ->
        doc.toObject(VideoSnapshot::class.java)
    }
}
```

---

## Step 2: Build Chart Data

The chart shows **growth between snapshots**, not absolute values.

### Chart Data Structure

```swift
struct ChartDataPoint {
    let date: String           // "Jan 15, 2:30 PM"
    let timestamp: TimeInterval
    let views: Int             // Growth since previous snapshot
    let likes: Int
    let comments: Int
    let shares: Int
    let engagementRate: Double
}
```

### Processing Logic

```swift
func buildChartData(video: Video, snapshots: [VideoSnapshot]) -> [ChartDataPoint] {
    var chartData: [ChartDataPoint] = []
    
    // Sort snapshots by date (oldest first)
    let sortedSnapshots = snapshots.sorted { 
        $0.capturedAt.dateValue() < $1.capturedAt.dateValue() 
    }
    
    // If no snapshots, create flat line from current video stats
    if sortedSnapshots.isEmpty {
        let now = Date()
        let point = ChartDataPoint(
            date: formatDate(now),
            timestamp: now.timeIntervalSince1970,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares ?? 0,
            engagementRate: calculateEngagement(video.views, video.likes, video.comments)
        )
        // Return duplicate points for flat line
        return [point, point]
    }
    
    // Build chart data from snapshots
    for (index, snapshot) in sortedSnapshots.enumerated() {
        let date = snapshot.capturedAt.dateValue()
        
        var displayViews: Int
        var displayLikes: Int
        var displayComments: Int
        var displayShares: Int
        
        if index == 0 {
            // 🟢 FIRST SNAPSHOT: Show absolute baseline values
            displayViews = snapshot.views
            displayLikes = snapshot.likes
            displayComments = snapshot.comments
            displayShares = snapshot.shares ?? 0
        } else {
            // 📈 SUBSEQUENT SNAPSHOTS: Show growth delta from previous
            let previous = sortedSnapshots[index - 1]
            displayViews = max(0, snapshot.views - previous.views)
            displayLikes = max(0, snapshot.likes - previous.likes)
            displayComments = max(0, snapshot.comments - previous.comments)
            displayShares = max(0, (snapshot.shares ?? 0) - (previous.shares ?? 0))
        }
        
        let engagement = displayViews > 0 
            ? Double(displayLikes + displayComments) / Double(displayViews) * 100 
            : 0
        
        chartData.append(ChartDataPoint(
            date: formatDate(date),
            timestamp: date.timeIntervalSince1970,
            views: displayViews,
            likes: displayLikes,
            comments: displayComments,
            shares: displayShares,
            engagementRate: engagement
        ))
    }
    
    // Append current video stats if different from last snapshot
    if let lastSnapshot = sortedSnapshots.last {
        let hasNewData = lastSnapshot.views != video.views ||
                         lastSnapshot.likes != video.likes ||
                         lastSnapshot.comments != video.comments
        
        if hasNewData {
            let now = Date()
            let displayViews = max(0, video.views - lastSnapshot.views)
            let displayLikes = max(0, video.likes - lastSnapshot.likes)
            let displayComments = max(0, video.comments - lastSnapshot.comments)
            let displayShares = max(0, (video.shares ?? 0) - (lastSnapshot.shares ?? 0))
            
            chartData.append(ChartDataPoint(
                date: formatDate(now),
                timestamp: now.timeIntervalSince1970,
                views: displayViews,
                likes: displayLikes,
                comments: displayComments,
                shares: displayShares,
                engagementRate: displayViews > 0 
                    ? Double(displayLikes + displayComments) / Double(displayViews) * 100 
                    : 0
            ))
        }
    }
    
    return chartData
}

func formatDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "MMM d, h:mm a"
    return formatter.string(from: date)
}

func calculateEngagement(_ views: Int, _ likes: Int, _ comments: Int) -> Double {
    guard views > 0 else { return 0 }
    return Double(likes + comments) / Double(views) * 100
}
```

---

## Step 3: Display the Graph

### Example Data Flow

```
Raw Snapshots from Firestore:
┌──────────────────────────────────────────────────────────────┐
│ Snapshot 1 (Jan 10)   │ views: 1,000  │ isInitialSnapshot ✓  │
│ Snapshot 2 (Jan 12)   │ views: 15,000 │                      │
│ Snapshot 3 (Jan 14)   │ views: 45,000 │                      │
│ Snapshot 4 (Jan 16)   │ views: 120,000│                      │
└──────────────────────────────────────────────────────────────┘
                              ↓
Chart Data Points (what you display):
┌──────────────────────────────────────────────────────────────┐
│ Point 1 (Jan 10)   │ views: 1,000   │ ← Baseline (absolute) │
│ Point 2 (Jan 12)   │ views: 14,000  │ ← Growth (+14k)       │
│ Point 3 (Jan 14)   │ views: 30,000  │ ← Growth (+30k)       │
│ Point 4 (Jan 16)   │ views: 75,000  │ ← Growth (+75k)       │
└──────────────────────────────────────────────────────────────┘
                              ↓
📈 Green Growth Graph:
        75k ────────────────────────── ●
                                      /
        30k ──────────────── ●───────/
                            /
        14k ────── ●───────/
                  /
         1k ● ───/
            └────┴────┴────┴────┴───→
           Jan10  12   14   16
```

### iOS SwiftUI Chart Example

```swift
import Charts

struct VideoGrowthChart: View {
    let chartData: [ChartDataPoint]
    
    var body: some View {
        Chart(chartData, id: \.timestamp) { point in
            AreaMark(
                x: .value("Date", Date(timeIntervalSince1970: point.timestamp)),
                y: .value("Views", point.views)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [Color.green.opacity(0.3), Color.green.opacity(0.05)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            
            LineMark(
                x: .value("Date", Date(timeIntervalSince1970: point.timestamp)),
                y: .value("Views", point.views)
            )
            .foregroundStyle(Color.green)
            .lineStyle(StrokeStyle(lineWidth: 2))
        }
        .chartXAxis {
            AxisMarks(values: .automatic) { value in
                AxisValueLabel(format: .dateTime.month().day())
            }
        }
        .chartYAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let intValue = value.as(Int.self) {
                        Text(formatNumber(intValue))
                    }
                }
            }
        }
    }
    
    func formatNumber(_ num: Int) -> String {
        if num >= 1_000_000 {
            return String(format: "%.1fM", Double(num) / 1_000_000)
        } else if num >= 1_000 {
            return String(format: "%.1fK", Double(num) / 1_000)
        }
        return "\(num)"
    }
}
```

### Android Compose Chart Example

```kotlin
@Composable
fun VideoGrowthChart(chartData: List<ChartDataPoint>) {
    // Using a charting library like Vico or MPAndroidChart
    
    val entries = chartData.mapIndexed { index, point ->
        Entry(index.toFloat(), point.views.toFloat())
    }
    
    AndroidView(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp),
        factory = { context ->
            LineChart(context).apply {
                val dataSet = LineDataSet(entries, "Views Growth").apply {
                    color = Color.GREEN
                    fillColor = Color.GREEN
                    fillAlpha = 50
                    setDrawFilled(true)
                    setDrawCircles(false)
                    lineWidth = 2f
                    mode = LineDataSet.Mode.CUBIC_BEZIER
                }
                
                data = LineData(dataSet)
                description.isEnabled = false
                legend.isEnabled = false
                
                xAxis.apply {
                    position = XAxis.XAxisPosition.BOTTOM
                    setDrawGridLines(false)
                }
                
                axisLeft.setDrawGridLines(true)
                axisRight.isEnabled = false
            }
        }
    )
}
```

---

## Step 4: Handle Edge Cases

### No Snapshots (Flat Line)

```swift
func buildChartData(video: Video, snapshots: [VideoSnapshot]) -> [ChartDataPoint] {
    // If no snapshots, show current value as flat line
    if snapshots.isEmpty {
        let basePoint = ChartDataPoint(
            date: "Now",
            timestamp: Date().timeIntervalSince1970,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares ?? 0,
            engagementRate: 0
        )
        
        // Duplicate for flat line visualization
        var duplicate = basePoint
        duplicate.timestamp += 1
        
        return [basePoint, duplicate]
    }
    
    // ... normal processing
}
```

### Single Snapshot

```swift
if snapshots.count == 1 {
    let snapshot = snapshots[0]
    let point = ChartDataPoint(
        date: formatDate(snapshot.capturedAt.dateValue()),
        timestamp: snapshot.capturedAt.dateValue().timeIntervalSince1970,
        views: snapshot.views,
        likes: snapshot.likes,
        comments: snapshot.comments,
        shares: snapshot.shares ?? 0,
        engagementRate: 0
    )
    
    // Add current video stats as second point if different
    if snapshot.views != video.views {
        let currentPoint = ChartDataPoint(
            date: "Now",
            timestamp: Date().timeIntervalSince1970,
            views: max(0, video.views - snapshot.views),  // Growth
            likes: max(0, video.likes - snapshot.likes),
            comments: max(0, video.comments - snapshot.comments),
            shares: max(0, (video.shares ?? 0) - (snapshot.shares ?? 0)),
            engagementRate: 0
        )
        return [point, currentPoint]
    }
    
    // Same values = flat line
    var duplicate = point
    duplicate.timestamp += 1
    return [point, duplicate]
}
```

### All Snapshots Have Same Values (Bug Indicator)

```swift
// Check for data sync issues
let allSameViews = snapshots.allSatisfy { $0.views == snapshots[0].views }
if allSameViews && snapshots.count > 1 {
    print("⚠️ WARNING: All snapshots have identical values - possible sync issue")
}
```

---

## Complete iOS Example

```swift
class VideoDetailViewModel: ObservableObject {
    @Published var video: Video?
    @Published var chartData: [ChartDataPoint] = []
    @Published var isLoading = true
    
    private let db = Firestore.firestore()
    
    func loadVideo(orgId: String, projectId: String, videoId: String) async {
        isLoading = true
        
        do {
            // 1. Fetch video document
            let videoDoc = try await db.collection("organizations")
                .document(orgId)
                .collection("projects")
                .document(projectId)
                .collection("videos")
                .document(videoId)
                .getDocument()
            
            guard let video = try? videoDoc.data(as: Video.self) else {
                print("❌ Failed to decode video")
                return
            }
            
            // 2. Fetch snapshots
            let snapshotsQuery = try await db.collection("organizations")
                .document(orgId)
                .collection("projects")
                .document(projectId)
                .collection("videos")
                .document(videoId)
                .collection("snapshots")
                .order(by: "capturedAt", descending: false)
                .getDocuments()
            
            let snapshots = snapshotsQuery.documents.compactMap { doc in
                try? doc.data(as: VideoSnapshot.self)
            }
            
            print("📊 Loaded \(snapshots.count) snapshots for video \(videoId)")
            
            // 3. Build chart data
            let chartData = buildChartData(video: video, snapshots: snapshots)
            
            // 4. Update UI on main thread
            await MainActor.run {
                self.video = video
                self.chartData = chartData
                self.isLoading = false
            }
            
        } catch {
            print("❌ Error loading video: \(error)")
            isLoading = false
        }
    }
    
    private func buildChartData(video: Video, snapshots: [VideoSnapshot]) -> [ChartDataPoint] {
        // ... (implementation from above)
    }
}
```

---

## Complete Android Example

```kotlin
class VideoDetailViewModel(
    private val db: FirebaseFirestore = Firebase.firestore
) : ViewModel() {
    
    private val _video = MutableStateFlow<Video?>(null)
    val video: StateFlow<Video?> = _video
    
    private val _chartData = MutableStateFlow<List<ChartDataPoint>>(emptyList())
    val chartData: StateFlow<List<ChartDataPoint>> = _chartData
    
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading
    
    fun loadVideo(orgId: String, projectId: String, videoId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            
            try {
                // 1. Fetch video
                val videoDoc = db.collection("organizations")
                    .document(orgId)
                    .collection("projects")
                    .document(projectId)
                    .collection("videos")
                    .document(videoId)
                    .get()
                    .await()
                
                val video = videoDoc.toObject(Video::class.java) ?: return@launch
                
                // 2. Fetch snapshots
                val snapshotsQuery = db.collection("organizations")
                    .document(orgId)
                    .collection("projects")
                    .document(projectId)
                    .collection("videos")
                    .document(videoId)
                    .collection("snapshots")
                    .orderBy("capturedAt", Query.Direction.ASCENDING)
                    .get()
                    .await()
                
                val snapshots = snapshotsQuery.documents.mapNotNull { 
                    it.toObject(VideoSnapshot::class.java) 
                }
                
                Log.d("VideoDetail", "Loaded ${snapshots.size} snapshots")
                
                // 3. Build chart data
                val chartData = buildChartData(video, snapshots)
                
                // 4. Update state
                _video.value = video
                _chartData.value = chartData
                _isLoading.value = false
                
            } catch (e: Exception) {
                Log.e("VideoDetail", "Error loading video", e)
                _isLoading.value = false
            }
        }
    }
    
    private fun buildChartData(video: Video, snapshots: List<VideoSnapshot>): List<ChartDataPoint> {
        // ... (implementation from above)
    }
}
```

---

## Quick Reference

| Situation | Chart Shows |
|-----------|-------------|
| 0 snapshots | Flat line at current value |
| 1 snapshot (same as current) | Flat line |
| 1 snapshot (different from current) | 2 points: baseline → growth |
| 2+ snapshots | Full growth chart with deltas |

### Key Points

1. **Always sort snapshots by `capturedAt` ascending** (oldest first)
2. **First point = absolute baseline** (initial snapshot value)
3. **Subsequent points = growth delta** (current - previous)
4. **Add current video stats** if different from last snapshot
5. **Use `max(0, delta)`** to prevent negative values

---

## Debugging

Add these logs to debug chart data:

```swift
print("📊 Video: \(video.title ?? "Unknown")")
print("   Current views: \(video.views)")
print("   Snapshots: \(snapshots.count)")

for (i, snapshot) in snapshots.enumerated() {
    let date = snapshot.capturedAt.dateValue()
    print("   [\(i)] \(date): views=\(snapshot.views), isInitial=\(snapshot.isInitialSnapshot ?? false)")
}

print("📈 Chart Data Points: \(chartData.count)")
for (i, point) in chartData.enumerated() {
    print("   [\(i)] \(point.date): views=\(point.views)")
}
```

---

*Now your green growth graph should show actual growth instead of a flat line!* 🚀
