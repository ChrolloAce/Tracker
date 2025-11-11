# Demo Mode Restrictions

## Overview
When users view the demo organization, all write actions are disabled to prevent modifications. This ensures the demo data remains consistent for all visitors while still allowing full exploration of features.

## What is Demo Mode?

Demo mode is activated when:
1. **URL Path**: User visits `/demo/*` routes (e.g., `/demo/dashboard`, `/demo/accounts`)
2. **Demo Context**: `DemoContext` provides hardcoded demo org/project IDs
3. **Read-Only Access**: All data is visible but cannot be modified

### Demo Organization Details
- **Demo Org ID**: `zcoz9Yc6BpjxsFogAIqr`
- **Demo Project ID**: `r2JV9idlIMO8dXbhpcR0`
- **Access**: Public (no login required)

## Disabled Actions

### 🚫 Content Management
All content creation and tracking is disabled:

1. **Add Video** ❌
   - Location: Top navigation "Add Video" button
   - Message: "Can't add videos - not your organization"
   - Visual: Grayed out button with tooltip

2. **Add Account** ❌
   - Location: Accounts page "Add Account" button
   - Message: "Can't Add - Not Your Org"
   - Visual: Disabled button in empty state

3. **Track Content** ❌
   - Location: Floating action button (bottom-right + button)
   - Affects: Dashboard, Accounts, Videos tabs
   - Message: "Can't add - not your organization"
   - Visual: Grayed out, no hover effect

### 🚫 Relationship Management

4. **Create Link** ❌
   - Location: Analytics/Links tab
   - Floating button disabled
   - Cannot create tracking links

5. **Add Creator** ❌
   - Location: Creators tab
   - Floating button disabled
   - Cannot add creator profiles

### 🚫 Team & Campaign Management

6. **Invite Team Member** ❌
   - Location: Team tab
   - Floating button disabled
   - Cannot send team invitations

7. **Create Campaign** ❌
   - Location: Campaigns tab
   - Floating button disabled
   - Cannot create marketing campaigns

## Visual Indicators

### Disabled Button Styles

#### Empty State Buttons
```css
/* When disabled in BlurEmptyState */
background: rgba(55, 65, 81, 0.5);  /* gray-700/50 */
color: rgba(156, 163, 175, 1);       /* gray-400 */
border: 1px solid rgba(55, 65, 81, 1); /* gray-700 */
cursor: not-allowed;
opacity: 0.6;
```

#### Floating Action Button
```css
/* When disabled */
background: rgba(75, 85, 99, 1);     /* gray-600 */
color: rgba(156, 163, 175, 1);       /* gray-400 */
border: 1px solid rgba(55, 65, 81, 1); /* gray-700 */
cursor: not-allowed;
opacity: 0.6;
/* No hover effects or scale transforms */
```

#### Regular Buttons
```css
/* Standard disabled state */
disabled: true
pointer-events: none
opacity: reduced
hover effects: removed
```

### Tooltip Messages

All disabled buttons show helpful tooltips on hover:

- **Short version**: "Can't Add - Not Your Org"
- **Detailed version**: "Can't add [action] - not your organization"
- **Generic**: "This action is disabled in demo mode"

## User Experience

### What Users CAN Do ✅
- ✅ **View all data**: Analytics, metrics, reports
- ✅ **Explore features**: Click through all tabs and sections
- ✅ **See full UI**: All components render normally
- ✅ **Filter & search**: Use filters and search functionality
- ✅ **Navigate**: Browse between different pages/tabs
- ✅ **Test interactions**: Click videos, view details, etc.

### What Users CANNOT Do ❌
- ❌ **Add content**: Videos, accounts, links
- ❌ **Modify data**: Edit, delete, or update anything
- ❌ **Invite others**: Cannot send team invitations
- ❌ **Create campaigns**: Cannot start new campaigns
- ❌ **Track new items**: Cannot add new tracking targets

## Technical Implementation

### Component Props

All components that need demo restrictions accept `isDemoMode`:

```typescript
interface ComponentProps {
  // ... other props
  isDemoMode?: boolean;
}
```

### Propagation Flow

```
DemoPage (sets isDemoMode: true)
  ↓
DemoContext.Provider
  ↓
DashboardPage (reads isDemoMode from context)
  ↓
Child Components (receive isDemoMode as prop)
    - TopNavigation
    - AccountsPage
    - TrackedLinksPage
    - CreatorsPage
    - etc.
```

### Code Example: Disabling a Button

```typescript
// In component
const { isDemoMode } = useDemoContext();

// Button implementation
<button
  onClick={isDemoMode ? undefined : handleClick}
  disabled={isDemoMode}
  className={`
    ${isDemoMode 
      ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-60' 
      : 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  `}
  title={isDemoMode ? "Can't modify demo organization" : "Add item"}
>
  {isDemoMode ? "Can't Add - Not Your Org" : "Add Item"}
</button>
```

### Empty State Actions

For `BlurEmptyState` components:

```typescript
<BlurEmptyState
  title="Add Your First Account"
  description="Track social media accounts"
  actions={[
    {
      label: isDemoMode ? "Can't Add - Not Your Org" : 'Add Account',
      onClick: () => {
        if (!isDemoMode) {
          setIsAddModalOpen(true);
        }
      },
      icon: Plus,
      primary: true,
      disabled: isDemoMode  // ← New property
    }
  ]}
/>
```

## Files Modified

### Core Components
1. **`src/pages/DashboardPage.tsx`**
   - Reads `isDemoMode` from `DemoContext`
   - Passes to child components
   - Disables floating action button

2. **`src/components/AccountsPage.tsx`**
   - Accepts `isDemoMode` prop
   - Disables "Add Account" button
   - Shows restriction message

3. **`src/components/layout/TopNavigation.tsx`**
   - Accepts `isDemoMode` prop
   - Disables "Add Video" button
   - Shows tooltip

4. **`src/components/ui/BlurEmptyState.tsx`**
   - Added `disabled` property to actions
   - Implements disabled button styling
   - Prevents onClick when disabled

### Context & Services
5. **`src/pages/DemoPage.tsx`**
   - Provides `DemoContext`
   - Sets `isDemoMode: true`
   - Hardcodes demo org/project IDs

6. **`src/services/DemoOrgService.ts`**
   - Helper methods for demo detection
   - Action permission checks
   - Restriction messages

## Testing Demo Mode

### Manual Testing Checklist

```
Access demo:
✅ Visit /demo/dashboard
✅ Confirm demo data loads

Try disabled actions:
✅ Click "Add Video" → should be grayed out
✅ Click "Add Account" → should show restriction message
✅ Click floating + button → should be disabled
✅ Hover buttons → should show "Can't add" tooltip

Verify allowed actions:
✅ Navigate between tabs → should work
✅ Click on video/account → details should open
✅ Use filters → should filter data
✅ Search → should search data
✅ View analytics → should display charts
```

### Browser Console Verification

```javascript
// Check demo mode is active
const demoContext = useDemoContext();
console.log('Demo mode:', demoContext.isDemoMode); // should be true
console.log('Demo org ID:', demoContext.demoOrgId);
console.log('Demo project ID:', demoContext.demoProjectId);
```

## Keyboard Shortcuts

**⚠️ Important**: Even with spacebar shortcuts, actions remain disabled in demo mode.

- **Spacebar**: Would normally open add modal
  - **Demo Mode**: No effect, button is disabled at component level
  
The restriction is implemented at the `onClick` handler level, so keyboard shortcuts calling the same handler are also blocked.

## Error Handling

If a user somehow bypasses UI restrictions (e.g., through browser console manipulation):

1. **Firestore Rules**: Demo org has read-only rules
2. **Service Layer**: `DemoOrgService.canPerformAction()` returns `false`
3. **API Validation**: Backend rejects write attempts to demo org

```typescript
// Example: Service-level check
if (DemoOrgService.isDemoOrg(orgId)) {
  throw new Error(DemoOrgService.getRestrictionMessage('write'));
}
```

## Future Enhancements

### Planned Features
- [ ] Demo mode indicator badge in navbar
- [ ] "Try it yourself" CTA when clicking disabled buttons
- [ ] Simulated "success" for demo actions (preview without saving)
- [ ] Time-limited personal demo instances
- [ ] Demo tour/guided walkthrough

### Potential Improvements
- [ ] Track which disabled buttons users click most
- [ ] A/B test different restriction messages
- [ ] Add "Sign up to unlock" modal on 3rd disabled click
- [ ] Show demo limitations in onboarding tooltip

## Related Documentation
- [Demo Organization Setup](./DEMO_ORG_SETUP.md)
- [Public Access Configuration](./PUBLIC_ACCESS.md)
- [Firestore Security Rules](../firestore.rules)

## Support

### Common Issues

**Q: Button still clickable in demo mode?**
A: Check that `isDemoMode` prop is being passed correctly through component tree.

**Q: Tooltip not showing?**
A: Verify tooltip has proper z-index and `group`/`group-hover` classes.

**Q: User can still modify demo data?**
A: Check Firestore rules - demo org should be read-only for all users.

**Q: New tab/page missing demo restrictions?**
A: Ensure the page reads from `DemoContext` and passes `isDemoMode` to child components.

### Debug Mode

Enable debug logging:
```typescript
// In DashboardPage.tsx
console.log('🎭 DEMO MODE:', isDemoMode);
console.log('📍 Demo Org ID:', demoOrgId);
console.log('📍 Demo Project ID:', demoProjectId);
```

## Contact
For issues with demo mode restrictions, contact:
- **Development Team**: dev@viewtrack.app
- **GitHub Issues**: https://github.com/ChrolloAce/Tracker/issues

