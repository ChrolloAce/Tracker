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
    id: 'standard',
    name: 'Standard Creator Agreement',
    description: 'Basic agreement for content creators',
    icon: 'FileText',
    terms: `1. SCOPE OF WORK
• Creator agrees to produce original content as specified
• All content must meet brand guidelines and quality standards
• Deliverables to be submitted by agreed deadlines

2. CONTENT OWNERSHIP & RIGHTS
• Creator retains ownership of original content
• Company receives perpetual license to use content for marketing
• Content may be modified for platform optimization

3. PAYMENT TERMS
• Payment as per agreed structure in Payment tab
• Payments processed within 30 days of invoice
• Late payments subject to review

4. TERM & TERMINATION
• Either party may terminate with 30 days written notice
• Creator must deliver all pending work upon termination
• Payment obligations continue for completed work

5. CONFIDENTIALITY
• Creator agrees to keep business information confidential
• Non-disclosure applies during and after contract period`,
    duration: { months: 12 }
  },
  {
    id: 'exclusive',
    name: 'Exclusive Partnership',
    description: 'Exclusive content creation with restrictions',
    icon: 'Handshake',
    terms: `1. EXCLUSIVITY AGREEMENT
• Creator will work exclusively with Company in specified niche
• No competing brand partnerships during contract period
• All sponsored content must be pre-approved

2. CONTENT REQUIREMENTS
• Minimum 4 videos per month
• Content must align with brand values
• First right of refusal on all new content ideas

3. INTELLECTUAL PROPERTY
• Company receives exclusive rights to all content created
• Content cannot be reposted on other platforms without permission
• Creator may not license content to third parties

4. COMPENSATION
• Base retainer plus performance bonuses
• Additional compensation for viral content (>1M views)
• Quarterly performance reviews

5. NON-COMPETE CLAUSE
• 6-month non-compete after contract ends
• Applies to direct competitors only
• Geographic restrictions apply

6. TERMINATION
• 60 days notice required
• Buyout option available
• Non-compete remains in effect`,
    duration: { months: 24 }
  },
  {
    id: 'campaign',
    name: 'Campaign-Based Contract',
    description: 'Short-term campaign or project',
    icon: 'Target',
    terms: `1. CAMPAIGN SCOPE
• Specific campaign deliverables outlined below
• Timeline: [Campaign Start] to [Campaign End]
• Total deliverables: [X] videos/posts

2. DELIVERABLES
• Content format and specifications agreed separately
• Submission deadlines must be met
• Revisions included: up to 2 rounds per piece

3. USAGE RIGHTS
• Company receives rights for campaign duration + 90 days
• Content can be used across all company channels
• Creator may repost after 30 days

4. PAYMENT
• 50% upfront upon contract signing
• 50% upon completion and approval of all deliverables
• Bonus for exceptional performance metrics

5. APPROVAL PROCESS
• Content submitted for review 48 hours before posting
• Company has 24 hours to request revisions
• Final approval required before publishing

6. CAMPAIGN COMPLETION
• All obligations end upon campaign completion
• Final payment processed within 15 days
• Option to extend for additional campaigns`,
    duration: { months: 3 }
  },
  {
    id: 'ambassador',
    name: 'Brand Ambassador',
    description: 'Long-term brand representation',
    icon: 'Crown',
    terms: `1. AMBASSADOR ROLE
• Creator represents brand in all public appearances
• Maintain professional image aligned with brand values
• Participate in brand events and initiatives

2. CONTENT OBLIGATIONS
• Regular content featuring products/services
• Monthly content calendar to be approved
• Stories, posts, and videos across platforms

3. EXCLUSIVITY
• No partnerships with competing brands
• All sponsorships must be disclosed and approved
• Brand has first right of refusal on opportunities

4. COMPENSATION PACKAGE
• Monthly retainer
• Performance-based bonuses
• Product gifting and early access
• Travel and event coverage

5. BRAND GUIDELINES
• Must adhere to brand style guide
• Advance approval required for off-brand content
• Regular check-ins with brand team

6. TERM & RENEWAL
• 12-month initial term
• Auto-renewal unless 60 days notice given
• Annual compensation review
• Renegotiation at renewal`,
    duration: { months: 12 }
  },
  {
    id: 'freelance',
    name: 'Freelance Per-Video',
    description: 'Pay per video with no commitment',
    icon: 'Video',
    terms: `1. PER-VIDEO AGREEMENT
• Each video is a separate engagement
• No ongoing commitment required
• Rates agreed per project

2. DELIVERABLES
• One completed video per agreement
• Includes: scripting, filming, editing, posting
• Timeline: 2 weeks from approval to delivery

3. CONTENT RIGHTS
• Creator retains ownership
• Company receives 6-month usage license
• Attribution required when reshared

4. PAYMENT
• Payment upon delivery and approval
• Paid via agreed payment method
• Net 15 payment terms

5. CREATIVE CONTROL
• Creator has full creative freedom
• Brand guidelines to be respected
• Approval required before posting

6. NO EXCLUSIVITY
• Creator free to work with any brands
• No non-compete restrictions
• Future collaborations on project basis`,
    duration: { months: 1 }
  }
];

