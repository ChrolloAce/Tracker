# Pre-Launch Cover Instructions

## 🚀 To See The Cover:

### Step 1: Clear Browser Storage
Open browser console (F12) and run:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 2: Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Hard Refresh
- **Chrome/Edge**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Firefox**: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- Or use **Incognito/Private mode** for fresh start

## 🔑 PIN Access

**Default PIN:** `1111`

To change it, edit `src/components/PreLaunchCover.tsx` line 6:
```typescript
const BYPASS_PIN = 'your-pin-here';
```

## ⚙️ Settings

In `src/components/PreLaunchCover.tsx`:

```typescript
// Launch date (countdown target)
const LAUNCH_DATE = new Date('2025-11-01T22:00:00').getTime(); // Nov 1, 10 PM EST

// Your secret PIN
const BYPASS_PIN = '1111';

// Force lock (ignore date, PIN-only access)
const FORCE_LOCK = true; // Set false to enable auto-unlock after date
```

## 🧪 Testing

**To test PIN bypass:**
1. Clear localStorage (see Step 1)
2. Refresh page
3. You should see the full-screen cover
4. Enter PIN: `1111`
5. Click "Unlock Early Access"
6. Cover disappears, app loads

**To remove cover entirely:**
Delete or comment out these lines in `src/App.tsx`:
- Line 28: `import { PreLaunchCover } from './components/PreLaunchCover';`
- Line 181: `<PreLaunchCover>`
- Line 536: `</PreLaunchCover>`

## 🔒 Current Status

✅ **FORCE_LOCK = true** - Won't auto-unlock even after Nov 1, 10 PM  
✅ **PIN Required** - Only way to access the app  
✅ **Countdown Active** - Shows time until Nov 1, 10 PM  
✅ **Covers ALL Routes** - Landing page, dashboard, all pages  

## 📝 Notes

- Cover is at z-index 9999 (highest layer)
- Bypass status stored in `localStorage.prelaunch_bypass_v2`
- Once bypassed with correct PIN, it stays bypassed
- To re-lock: Clear localStorage and refresh

