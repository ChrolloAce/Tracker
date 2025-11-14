# Clear Apple Revenue Data and Re-sync

## Steps to Fix Cumulative Data

### 1. Delete Old Revenue Data
Go to Firestore Console:
```
organizations/{orgId}/projects/{projectId}/revenueMetrics/apple_summary
```

Delete this document (or update it to remove `dailyMetrics` array).

### 2. Re-sync with Longer Date Range
In your app, trigger a sync with 90 days to rebuild clean data:
- Go to Revenue Management
- Click "Sync" on Apple integration  
- This will fetch last 90 days with proper filtering

### 3. Verify the Numbers
After re-sync, the cumulative totals should match your actual app data:
- ~400 downloads
- ~$300 revenue

## Why This Happened
The cumulative data included historical syncs from BEFORE you added the Apple ID filter (6752973301).
Now that the filter is working, you just need fresh data!

## Current Status (Working Correctly!)
✅ Filter working: 321 records kept, 162 skipped
✅ Only app 6752973301 (maktubtechnologies.Distant) is being tracked
✅ Other 9 apps in account are being filtered out

