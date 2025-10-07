# Twitter Sync Diagnostic Guide

## Issue Summary

The Twitter account sync for `ernestoSOFTWARE` is returning 0 tweets, even though the sync process completes successfully. This guide will help you diagnose and fix the issue.

## What Was Changed

I've added comprehensive diagnostic logging to help identify the root cause:

### 1. Enhanced Logging in API Endpoints

**Files Modified:**
- `api/apify-proxy.ts` - Added detailed logging for Apify API calls
- `api/sync-single-account.ts` - Added Twitter-specific diagnostics
- `api/cron-sync-accounts.ts` - Added Twitter-specific diagnostics

**New Logging Includes:**
- ✅ Actor ID (normalized)
- ✅ Input parameters sent to Apify
- ✅ Response status codes
- ✅ Raw data structure from Apify
- ✅ Sample data (first 500-1000 characters)
- ✅ Item count at each stage
- ✅ Detailed warnings when 0 items are found

### 2. New Diagnostic Endpoint

**File Created:** `api/test-twitter-scraper.ts`

This standalone endpoint lets you test Twitter scraping independently.

## How to Use the Diagnostic Endpoint

### Method 1: Via Browser or cURL

```bash
# Test with a known working Twitter account
curl "https://your-app.vercel.app/api/test-twitter-scraper?username=elonmusk"

# Test with your problematic account
curl "https://your-app.vercel.app/api/test-twitter-scraper?username=ernestoSOFTWARE"
```

### Method 2: Via Browser

Visit:
```
https://your-app.vercel.app/api/test-twitter-scraper?username=ernestoSOFTWARE
```

### What to Look For

The diagnostic endpoint returns:

```json
{
  "success": true,
  "stats": {
    "totalItems": 0,
    "originalTweets": 0,
    "retweets": 0,
    "duration": "1234ms"
  },
  "diagnostics": {
    "possibleIssues": [
      "Account may not exist or username is incorrect",
      "Account may be private",
      "Account may have no tweets",
      "Apify actor may have changed or been deprecated"
    ]
  }
}
```

## Troubleshooting Steps

### Step 1: Verify the Twitter Account Exists

1. Go to `https://twitter.com/ernestoSOFTWARE` (or `https://x.com/ernestoSOFTWARE`)
2. Check if the account exists and is public
3. Check if the account has any tweets

### Step 2: Test with a Known Working Account

Use the diagnostic endpoint with a known active Twitter account:

```bash
curl "https://your-app.vercel.app/api/test-twitter-scraper?username=elonmusk"
```

If this returns tweets, the Apify actor is working. The issue is specific to your account.

### Step 3: Check Vercel Logs

After triggering a sync, check your Vercel logs for the new diagnostic output:

```
🐦 Fetching tweets for ernestoSOFTWARE...
👤 Fetching profile data for ernestoSOFTWARE...
📡 Profile response status: 200
📊 Profile data received: {"items":[...]}
📊 Raw tweets data structure: ["items", "run"]
📊 Tweets data sample: {...}
📊 Total items received: 0
⚠️ No tweets found for @ernestoSOFTWARE. This could mean:
   - The account has no tweets
   - The account is private
   - The account doesn't exist
   - The Apify actor is not working properly
   - The username format is incorrect
```

### Step 4: Check Username Format

The Apify actor expects just the username without the `@` symbol:

✅ **CORRECT:** `ernestoSOFTWARE`  
❌ **WRONG:** `@ernestoSOFTWARE`

### Step 5: Verify Apify Token

Check that your `APIFY_TOKEN` environment variable is set correctly in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify `APIFY_TOKEN` exists and is valid
3. The token should start with `apify_api_`

## Common Issues and Solutions

### Issue 1: Account Doesn't Exist or Username is Wrong

**Symptom:** 0 tweets returned, even for profile fetch

**Solution:**
- Verify the exact username on Twitter
- Note that Twitter usernames are case-insensitive, but must be exact
- Check if the account has been suspended or deleted

### Issue 2: Account is Private

**Symptom:** 0 tweets returned, profile data may work

**Solution:**
- The Apify scraper cannot access private accounts
- The account must be public for scraping to work
- Ask the account owner to make it public

### Issue 3: Account Has No Tweets

**Symptom:** 0 tweets returned, but profile data is fetched successfully

**Solution:**
- This is expected behavior if the account truly has no tweets
- Check the actual Twitter account to confirm

### Issue 4: Apify Actor Issue

**Symptom:** 0 tweets returned for all accounts, including known active ones

**Solution:**
- The `apidojo/tweet-scraper` actor may be deprecated or broken
- Check Apify's actor page: https://console.apify.com/actors/apidojo~tweet-scraper
- Consider switching to an alternative actor

### Issue 5: Rate Limiting

**Symptom:** Works sometimes but not always

**Solution:**
- Twitter/Apify may be rate limiting
- Add delays between requests
- Consider upgrading your Apify plan

## Alternative Twitter Scrapers

If `apidojo/tweet-scraper` is not working, consider these alternatives:

1. **`heLL0o~twitter-scraper`** - Community maintained
2. **`quacker~twitter-scraper`** - Newer, actively maintained
3. **Direct Twitter API** - Requires Twitter API credentials (paid)

### How to Switch Scrapers

Update the `actorId` in these files:
- `api/sync-single-account.ts` (line 194 and 240)
- `api/cron-sync-accounts.ts` (line 152 and 196)
- `src/services/TwitterApiService.ts` (line 39)

Change from:
```typescript
actorId: 'apidojo/tweet-scraper',
```

To:
```typescript
actorId: 'heLL0o/twitter-scraper',
```

## Debugging Checklist

- [ ] Verified the Twitter account exists and is public
- [ ] Tested with a known working account (e.g., @elonmusk)
- [ ] Checked Vercel logs for detailed diagnostic output
- [ ] Verified username format (no @ symbol)
- [ ] Confirmed APIFY_TOKEN is set correctly
- [ ] Checked if the Apify actor is still active
- [ ] Tested the diagnostic endpoint
- [ ] Reviewed the raw Apify response in logs

## Next Steps

1. **Run the diagnostic endpoint** with `ernestoSOFTWARE`
2. **Check the Vercel logs** for the detailed output
3. **Compare results** with a known working account
4. **Based on findings**, implement the appropriate solution

## Need Help?

If you're still experiencing issues after following this guide:

1. Check the Vercel logs and copy the full Twitter sync log output
2. Run the diagnostic endpoint and save the full JSON response
3. Visit the Apify actor page to check if it's still active
4. Consider opening an issue with the Apify actor maintainer if the actor is broken

## Summary of Files Changed

1. ✅ `api/apify-proxy.ts` - Enhanced logging
2. ✅ `api/sync-single-account.ts` - Twitter diagnostic logging
3. ✅ `api/cron-sync-accounts.ts` - Twitter diagnostic logging
4. ✅ `api/test-twitter-scraper.ts` - NEW diagnostic endpoint

All changes are backward compatible and only add logging - no breaking changes.

