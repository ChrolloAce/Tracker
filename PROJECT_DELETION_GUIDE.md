# Project Deletion Feature

## Overview
Complete project deletion functionality that permanently removes a project and **all** associated data from the database.

## What Gets Deleted

When you delete a project, the following data is permanently removed:

### Main Collections
1. **Tracked Accounts** (`trackedAccounts`)
   - All social media accounts linked to the project
   - Account metadata and statistics

2. **Videos** (`videos`)
   - All tracked video data
   - Video snapshots and metrics history
   - View/like/comment statistics

3. **Links** (`links`)
   - All tracked links
   - Click data and analytics
   - Link performance metrics

4. **Campaigns** (`campaigns`)
   - All campaign data
   - Campaign submissions
   - Campaign analytics

5. **Tracking Rules** (`trackingRules`)
   - Automated tracking rules
   - Rule configurations

6. **Payout Structures** (`payoutStructures`)
   - Payment structures
   - Tiered payment configurations

7. **Creators** (`creators`)
   - Creator profiles linked to project
   - Creator-account associations

8. **Payouts** (`payouts`)
   - Historical payout records
   - Payment calculations

9. **Stats** (`stats`)
   - Project statistics
   - Aggregated metrics

### Additional Updates
- **Organization Project Count**: Decremented automatically
- **Project Document**: Completely removed (not just archived)

## User Interface

### Location
Access project deletion from:
1. Click the **pencil icon** next to any project in the **Project Switcher**
2. Scroll to bottom of Edit Project modal
3. Find the **"Danger Zone"** section

### Deletion Flow

#### Step 1: Initial Warning
```
┌─────────────────────────────────────┐
│ ⚠️  Danger Zone                     │
│                                     │
│ Deleting this project will         │
│ permanently remove all data...      │
│                                     │
│ [ Delete Project ]                  │
└─────────────────────────────────────┘
```

#### Step 2: Type-to-Confirm
After clicking "Delete Project", you must type the **exact project name**:

```
┌─────────────────────────────────────┐
│ Type "My Project" to confirm:       │
│ ┌─────────────────────────────────┐ │
│ │ [Type project name here]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [ Cancel ]  [ Permanently Delete ]  │
└─────────────────────────────────────┘
```

#### Step 3: Deletion Process
- Button changes to "Deleting..."
- All data deleted in batches
- Automatic redirect to dashboard
- Page reload to show updated project list

## Technical Implementation

### Service Method
```typescript
ProjectService.deleteProject(orgId, projectId, userId)
```

### Deletion Algorithm
1. **Fetch org data** to get current project count
2. **Delete subcollections** (one at a time, batched)
3. **Delete project document**
4. **Update org project count**

### Batch Processing
- Handles collections of any size
- Processes 500 documents per batch (Firestore limit)
- Commits batches progressively
- Comprehensive logging for each step

### Code Example
```typescript
// Delete a project
await ProjectService.deleteProject(
  'org-id',
  'project-id',
  'user-id'
);
```

## Safety Features

### 1. Type-to-Confirm
- Must type **exact** project name
- Case-sensitive matching
- Prevents accidental deletions

### 2. Clear Warnings
- Red "Danger Zone" section
- Warning icon (⚠️)
- Explicit text about permanent deletion

### 3. Cannot Be Undone
- Clear messaging that deletion is permanent
- No "soft delete" or archive
- True data removal

### 4. Comprehensive Logging
```
🗑️ Starting deletion of project abc123
🗑️ Deleting 9 subcollections for project abc123
🗑️ Deleting 15 documents from trackedAccounts
  ✓ Committed batch of 15 deletions
✅ Deleted 15 documents from trackedAccounts
✓ videos: empty, skipping
...
✅ Successfully deleted project abc123 and all its data
```

## Error Handling

### If Deletion Fails
- Error caught and logged
- User notified with error message
- Deletion state reset
- Modal remains open for retry

### Partial Deletion
- Each subcollection deleted independently
- If one fails, error logged but continues
- Final project document only deleted if subcollections succeed

## Performance Considerations

### Large Projects
- **500 documents/batch** ensures efficient deletion
- Progress logged for visibility
- No timeout issues with large datasets

### Example Timings
- Small project (< 100 items): ~1-2 seconds
- Medium project (100-1000 items): ~3-5 seconds
- Large project (1000+ items): ~5-10 seconds

## Use Cases

### When to Delete a Project
✅ **Good reasons:**
- Test project no longer needed
- Duplicate project created by mistake
- Client project completed and data no longer needed
- Consolidating multiple projects

❌ **Bad reasons:**
- Temporary cleanup (use archive instead)
- Uncertain about keeping data (export first)
- Just want to hide it (use archive feature)

### Alternative: Archive
If you're unsure, use **Archive** instead:
```typescript
ProjectService.archiveProject(orgId, projectId, userId)
```
- Data preserved but hidden
- Can be unarchived later
- Reversible action

## Best Practices

### Before Deleting
1. **Export important data** if needed
2. **Verify project name** to ensure correct project
3. **Check active campaigns** - deletion affects them
4. **Notify team members** if shared project

### After Deleting
1. **Verify project removed** from switcher
2. **Check org project count** updated correctly
3. **Confirm no orphaned data** remains

## Troubleshooting

### "Project name does not match"
- Check spelling and capitalization
- Ensure no extra spaces
- Copy-paste project name if unsure

### Deletion Seems Stuck
- Check console for progress logs
- Large projects take longer (see Performance)
- Wait for automatic redirect

### Project Still Appears
- Hard refresh browser (Cmd/Ctrl + Shift + R)
- Clear cache if necessary
- Check if you're in correct organization

## Database Structure

### Firestore Path
```
organizations/{orgId}/projects/{projectId}/
  ├── trackedAccounts/{accountId}
  ├── videos/{videoId}
  ├── links/{linkId}
  ├── campaigns/{campaignId}
  ├── trackingRules/{ruleId}
  ├── payoutStructures/{structureId}
  ├── creators/{creatorId}
  ├── payouts/{payoutId}
  └── stats/current
```

All of these are **completely deleted** when project is deleted.

## Security & Permissions

### Who Can Delete
- **Organization Owner**: Can delete any project
- **Admin**: Can delete any project
- **Member**: Cannot delete projects (feature disabled)

### Firestore Rules
Ensure your `firestore.rules` allows deletion:
```
allow delete: if isOwnerOrAdmin(organizationId);
```

## Future Enhancements

### Planned Features
- [ ] Export project data before deletion
- [ ] Bulk project deletion
- [ ] Scheduled deletion (delete after X days)
- [ ] Deletion history/audit log
- [ ] Restore from backup (if implemented)

### Possible Improvements
- Background deletion for very large projects
- Email confirmation for critical projects
- Dry-run mode (preview what will be deleted)
- Deletion analytics and reporting

## Related Documentation
- [Project Management Guide](./PROJECT_GUIDE.md)
- [Data Migration Guide](./DATA_MIGRATION_GUIDE.md)
- [Organization Settings](./ORGANIZATION_SETTINGS.md)

## Support
If you encounter issues with project deletion:
1. Check console logs for detailed error messages
2. Verify Firestore permissions
3. Check if project has active campaigns or payouts
4. Contact support with project ID and error logs

