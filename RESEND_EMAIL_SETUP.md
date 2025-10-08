# Resend Email Setup Guide

## ✅ Current Status
Your application is **already configured** to send emails via Resend! The basic setup is complete.

##📧 Email Features Implemented

### 1. Team Member Invitations
- Beautiful email template with your branding
- Includes invitation link and role information
- Expires in 7 days

### 2. Creator Invitations
- Specialized template for creators
- Shows project and organization details
- Access to creator portal link

### 3. Test Emails
- Test endpoint: `/api/send-test-email`
- Verifies Resend integration is working

---

## 🚀 Production Setup (Recommended)

### Step 1: Get a Resend API Key
1. Go to [resend.com](https://resend.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `re_`)

### Step 2: Add Your Domain (Optional but Recommended)

#### Why add a domain?
- Emails sent from `onboarding@resend.dev` have limited functionality
- Your own domain increases deliverability and trust
- Allows custom "from" addresses like `noreply@yourdomain.com`

#### How to add your domain:
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides:
   - **SPF Record**: Helps prevent spam
   - **DKIM Record**: Authenticates your emails
   - **MX Records**: (Optional) For receiving emails
5. Wait for DNS propagation (5-60 minutes)
6. Verify domain in Resend dashboard

### Step 3: Update Environment Variables

Add your Resend API key to Vercel:

```bash
# In Vercel Dashboard → Settings → Environment Variables
RESEND_API_KEY=re_your_actual_key_here
```

Or via CLI:
```bash
vercel env add RESEND_API_KEY
```

### Step 4: Update the "From" Email Address

After adding your domain, update the email service:

**File:** `api/send-test-email.ts`

```typescript
// Change this line:
from: 'onboarding@resend.dev',

// To your custom domain:
from: 'noreply@yourdomain.com',
```

---

## 🎨 Email Templates

### Team Invitation Email
- **Subject:** `[Inviter] invited you to join [Organization]`
- **Style:** Purple gradient, professional design
- **CTA:** "Accept Invitation" button

### Creator Invitation Email
- **Subject:** `You've been added as a creator to [Project]`
- **Style:** Pink gradient, creative design
- **CTA:** "Access Creator Portal" button
- **Benefits Listed:**
  - View performance metrics
  - Track content performance
  - Submit new content
  - Access payout information

---

## 🧪 Testing

### Test Email Sending
```typescript
import EmailService from './src/services/EmailService';

// Test general email
const result = await EmailService.sendTestEmail('your@email.com');
console.log(result);

// Test team invitation
await EmailService.sendTeamInvitation({
  to: 'teammate@example.com',
  inviterName: 'John Doe',
  organizationName: 'Acme Inc',
  role: 'admin',
  inviteLink: 'https://yourapp.com/invitations/123'
});

// Test creator invitation
await EmailService.sendCreatorInvitation({
  to: 'creator@example.com',
  inviterName: 'John Doe',
  organizationName: 'Acme Inc',
  projectName: 'Project Alpha',
  inviteLink: 'https://yourapp.com/invitations/456'
});
```

---

## 🔒 Security Best Practices

### 1. API Key Security
- ✅ API key stored in environment variables (not in code)
- ✅ Never commit API keys to Git
- ✅ Use different keys for development and production

### 2. Email Validation
- ✅ Emails are validated before sending
- ✅ Duplicate invitations are prevented
- ✅ Invitations expire after 7 days

### 3. Rate Limiting
Resend has built-in rate limits:
- **Free Plan:** 100 emails/day
- **Pro Plan:** 50,000 emails/month
- **Enterprise:** Custom limits

---

## 📊 Resend Dashboard

Monitor your emails at [resend.com/emails](https://resend.com/emails):
- View delivery status
- Track open rates
- See bounce rates
- Debug failed sends

---

## 🐛 Troubleshooting

### Email Not Sending?

1. **Check API Key**
   ```bash
   # Verify key is set in Vercel
   vercel env ls
   ```

2. **Check Console Logs**
   ```javascript
   // Look for these messages:
   ✅ Created invitation for email@example.com
   📧 Sent team invitation email to email@example.com
   ```

3. **Verify Email Address**
   - Must be a valid email format
   - No typos in recipient address

4. **Check Resend Dashboard**
   - Go to [resend.com/emails](https://resend.com/emails)
   - Check for error messages

### Common Errors

#### "DNS not verified"
- Solution: Wait for DNS propagation (up to 60 minutes)
- Check DNS records are correctly added

#### "Rate limit exceeded"
- Solution: Upgrade your Resend plan
- Or wait for rate limit to reset

#### "Invalid API key"
- Solution: Generate new key in Resend dashboard
- Update `RESEND_API_KEY` in Vercel

---

## 💰 Pricing

### Resend Free Plan
- ✅ 3,000 emails/month
- ✅ 100 emails/day
- ✅ Perfect for getting started

### Resend Pro Plan ($20/month)
- 50,000 emails/month
- No daily limit
- Priority support
- Analytics dashboard

---

## 🎯 Next Steps

1. ✅ Email service is already integrated
2. **Optional:** Add your custom domain to Resend
3. **Optional:** Update "from" address in code
4. **Test:** Send a test invitation to verify everything works

---

## 📝 Notes

- Emails are sent asynchronously (won't block user actions)
- Failed emails are logged but don't prevent invitation creation
- All email templates are responsive and mobile-friendly
- Templates follow email best practices (plain text fallback, accessibility)

---

## 📞 Support

- **Resend Docs:** https://resend.com/docs
- **Resend Support:** support@resend.com
- **Email Templates:** Already included in your codebase!

---

**✨ You're all set!** Emails will be sent automatically when:
- You invite a team member
- You add a creator to a project

