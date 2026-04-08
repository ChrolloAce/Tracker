/**
 * Contract Template Types
 */

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  terms: string;
  duration?: { months: number };
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'influencer-views',
    name: 'Influencer Agreement — View Guarantee',
    description: '$1,200 for 1M views, prorated payouts, cross-posted across TikTok, Instagram & YouTube',
    icon: 'Video',
    terms: `INFLUENCER CONTENT AGREEMENT

This Agreement ("Agreement") is entered into as of {{START_DATE}} by and between {{COMPANY_NAME}} ("Company") and {{CREATOR_NAME}} ("Creator").

1. COMPENSATION
Creator shall receive $1,200 USD for achieving 1,000,000 (one million) total views across all approved video content ("View Guarantee").

Views are paid out once the View Guarantee threshold is met. Views may be prorated at any time at Company's discretion — for example, if a Creator reaches 500,000 views, they may receive a prorated payout of $600.

2. CONTENT APPROVAL
All videos must be submitted to Company for approval prior to publishing. Company reserves the right to request edits or reject content that does not meet brand guidelines or quality standards.

3. CROSS-POSTING & VIEW COUNTING
Videos may be cross-posted across TikTok, Instagram, and YouTube. A single video posted across multiple platforms will be counted as one video. Views from all platforms are combined for that video.

Example: If a video receives 50,000 views on YouTube, 30,000 views on TikTok, and 100,000 views on Instagram, that single video counts as 180,000 total views toward the View Guarantee.

4. CONTENT RIGHTS
Company receives a perpetual, non-exclusive license to use, modify, and distribute all approved content across its marketing channels. Creator retains ownership of original content.

5. PAYMENT TERMS
Payments will be processed within 30 days of the View Guarantee being met or upon prorated payout approval. Payment will be made via Company's standard payment method.

6. TERM & TERMINATION
This Agreement is effective from {{START_DATE}} through {{END_DATE}}. Either party may terminate with 14 days written notice. Payment obligations remain for all approved and published content.

7. CONFIDENTIALITY
Creator agrees to keep all business discussions, strategies, and non-public information confidential during and after the term of this Agreement.

Agreed to by the parties identified above.`,
    duration: { months: 6 }
  },
  {
    id: 'ugc-crosspost',
    name: 'UGC Agreement — Cross-Posted Content',
    description: '$15/post across TikTok, Instagram & YouTube, 1-2x daily, $100 bonus per extra 100K views',
    icon: 'Target',
    terms: `USER-GENERATED CONTENT (UGC) AGREEMENT

This Agreement ("Agreement") is entered into as of {{START_DATE}} by and between {{COMPANY_NAME}} ("Company") and {{CREATOR_NAME}} ("Creator").

1. CONTENT & POSTING SCHEDULE
Creator shall produce and post original content 1 to 2 times per day, cross-posted across TikTok, Instagram, and YouTube. The exact posting frequency will be agreed upon via direct communication between Company and Creator.

2. COMPENSATION
Creator shall receive $15 USD per cross-posted post. A "cross-posted post" is defined as one piece of content published across TikTok, Instagram, and YouTube (counts as one post regardless of how many platforms it appears on).

3. PERFORMANCE BONUS
Creator shall receive a $100 USD bonus for every additional 100,000 views earned beyond the standard expectations. For example:
• 100,000 extra views = $100 bonus
• 250,000 extra views = $200 bonus (prorated to nearest 100K)
• 500,000 extra views = $500 bonus

View counts are aggregated across all platforms for each piece of content.

4. CONTENT APPROVAL
All content must align with Company brand guidelines. Company reserves the right to request revisions or reject content that does not meet standards. Creator will be notified of any issues within 24 hours of submission.

5. CONTENT RIGHTS
Company receives a perpetual, non-exclusive license to use, repost, and modify all content created under this Agreement. Creator retains ownership of original content.

6. PAYMENT TERMS
Payments will be calculated weekly based on posts delivered and bonuses earned. Payment processed within 14 days via Company's standard payment method.

7. TERM & TERMINATION
This Agreement is effective from {{START_DATE}} through {{END_DATE}}. Either party may terminate with 7 days written notice. Creator will be compensated for all content delivered up to the termination date.

8. COMMUNICATION
Creator and Company agree to maintain regular communication regarding content direction, posting schedule adjustments, and performance. Posting frequency may be adjusted by mutual agreement at any time.

Agreed to by the parties identified above.`,
    duration: { months: 3 }
  }
];
