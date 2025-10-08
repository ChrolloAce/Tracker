# Email Deliverability Setup Guide

This guide helps you improve email deliverability for ViewTrack emails sent from `viewtrack.app`.

## ✅ Completed Fixes

### 1. Updated From Address
- **Before:** `ViewTrack <noreply@viewtrack.app>` ❌
- **After:** `ViewTrack <team@viewtrack.app>` ✅

**Why:** Using "noreply" decreases trust and signals one-way communication. "team@" is more approachable and allows recipients to reply.

### 2. Fixed Invite Link Domain
- **Before:** `https://tracker-red-zeta.vercel.app/invitations/...` ❌
- **After:** `https://viewtrack.app/invitations/...` ✅

**Why:** Links should match the sending domain (`viewtrack.app`) to avoid spam filters.

---

## 🔧 Required: DNS Configuration

### DMARC Record Setup

You **MUST** add a DMARC record to your DNS to improve email deliverability.

#### Step 1: Access Your DNS Provider
Go to your domain registrar where `viewtrack.app` is registered (e.g., Namecheap, GoDaddy, Cloudflare).

#### Step 2: Add TXT Record

**Record Details:**
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@viewtrack.app; pct=100; adkim=s; aspf=s
TTL: 3600 (or leave default)
```

**What This Means:**
- `v=DMARC1` - DMARC version 1
- `p=quarantine` - Quarantine emails that fail authentication (safer than reject)
- `rua=mailto:dmarc@viewtrack.app` - Send aggregate reports here
- `pct=100` - Apply policy to 100% of emails
- `adkim=s` - Strict DKIM alignment
- `aspf=s` - Strict SPF alignment

#### Step 3: Verify DMARC Record

After adding, verify using:
```bash
nslookup -type=TXT _dmarc.viewtrack.app
```

Or use online tools:
- https://mxtoolbox.com/dmarc.aspx
- https://dmarcian.com/dmarc-inspector/

---

## 📧 Resend Configuration

### Email Addresses to Add in Resend

You need to add `team@viewtrack.app` as a verified sender in Resend:

1. Go to: https://resend.com/domains
2. Click on `viewtrack.app` domain
3. Go to "From Addresses"
4. Add: `team@viewtrack.app`

### Expected DNS Records

Resend should have already set up these records for `viewtrack.app`:

#### SPF Record
```
Type: TXT
Host: @
Value: v=spf1 include:_spf.resend.com ~all
```

#### DKIM Records
Resend will provide 3 CNAME records:
```
Type: CNAME
Host: resend._domainkey
Value: [provided by Resend]

Type: CNAME
Host: resend2._domainkey
Value: [provided by Resend]

Type: CNAME
Host: resend3._domainkey
Value: [provided by Resend]
```

---

## 🌐 Vercel Domain Setup

Since `viewtrack.app` is your sending domain, you should also point it to your Vercel deployment:

### Option 1: Use viewtrack.app as Primary Domain

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add `viewtrack.app` as a domain
3. Add DNS records from Vercel to your DNS provider:
   ```
   Type: A
   Host: @
   Value: 76.76.21.21
   
   Type: CNAME
   Host: www
   Value: cname.vercel-dns.com
   ```

### Option 2: Keep Vercel Subdomain, Use Email Domain

If you want to keep using `tracker-red-zeta.vercel.app` for the app but `viewtrack.app` only for emails:

**Update the code back to:**
```typescript
const baseUrl = 'https://tracker-red-zeta.vercel.app';
```

And update all email templates to reference `viewtrack.app`:
```html
<a href="https://viewtrack.app">Visit ViewTrack</a>
```

**⚠️ Note:** This is NOT recommended as it causes domain mismatch issues.

---

## 🎯 Recommended Setup

For best email deliverability:

1. **Use `viewtrack.app` as your main domain**
   - Point it to Vercel deployment
   - All invite links use `viewtrack.app`
   - All emails sent from `team@viewtrack.app`
   - All branding uses `viewtrack.app`

2. **Add DMARC, SPF, and DKIM records**
   - Follow steps above
   - Verify all records are active

3. **Test email deliverability**
   ```bash
   # Send test email
   # Check spam score at: https://www.mail-tester.com/
   ```

---

## 📊 Testing Checklist

After setup, verify:

- [ ] DMARC record exists: `nslookup -type=TXT _dmarc.viewtrack.app`
- [ ] SPF record exists: `nslookup -type=TXT viewtrack.app`
- [ ] DKIM records exist: `nslookup -type=CNAME resend._domainkey.viewtrack.app`
- [ ] Domain verified in Resend
- [ ] `team@viewtrack.app` added as sender in Resend
- [ ] Test email arrives quickly (not in spam)
- [ ] Invite links use `viewtrack.app` domain
- [ ] No "noreply" in from address

---

## 🐛 Troubleshooting

### Emails Going to Spam
1. Check DMARC/SPF/DKIM records are all set up
2. Verify domain in Resend dashboard
3. Test with: https://www.mail-tester.com/
4. Warm up your domain by sending to engaged users first

### Emails Delayed
1. Check Resend dashboard for delivery status
2. Verify DNS propagation (can take 24-48 hours)
3. Check recipient's spam folder
4. Monitor Resend logs for errors

### Links Not Working
1. Verify Vercel domain is set up correctly
2. Test invite link manually
3. Check firestore rules allow invitation access

---

## 🔗 Helpful Resources

- **Resend Docs:** https://resend.com/docs
- **DMARC Analyzer:** https://dmarcian.com/
- **DNS Checker:** https://dnschecker.org/
- **Email Tester:** https://www.mail-tester.com/
- **SPF Record Checker:** https://mxtoolbox.com/spf.aspx

---

## 📝 Summary

**Priority Actions:**
1. ✅ Changed from address to `team@viewtrack.app` (done)
2. ✅ Updated invite links to use `viewtrack.app` (done)
3. 🔴 **YOU MUST DO:** Add DMARC record to DNS
4. 🟡 **Recommended:** Point `viewtrack.app` to Vercel
5. 🟡 **Recommended:** Add `team@viewtrack.app` in Resend

After completing the DNS setup, email delivery should be fast and reliable! 🚀

