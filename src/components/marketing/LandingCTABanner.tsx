import React from 'react';
import { ArrowRight } from 'lucide-react';

interface LandingCTABannerProps {
  /** Copy variant. Controls headline, body, and button label. */
  variant?: 'compact' | 'full' | 'footer';
  /** Override the default headline */
  headline?: string;
  /** Override the default body copy */
  body?: string;
  /** Override the default button label */
  buttonLabel?: string;
}

const LANDING_URL = 'https://www.viewtrack.app';

/**
 * LandingCTABanner. Public marketing CTA for share pages (/a/:token, /c/:token).
 * Uses the brutalist depth-shadow button style consistent with the rest of the app.
 * Always opens in a new tab so the shared content the viewer came to see stays open.
 */
const LandingCTABanner: React.FC<LandingCTABannerProps> = ({
  variant = 'full',
  headline,
  body,
  buttonLabel,
}) => {
  if (variant === 'footer') {
    const h = headline || 'Want a dashboard like this?';
    const b = body || 'Track any TikTok, Instagram, YouTube, or X account. Get views, likes, and engagement metrics automatically.';
    const cta = buttonLabel || 'Start Tracking Free';

    return (
      <div className="bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-2xl p-8 md:p-12 text-center">
        <h3 className="text-2xl md:text-3xl font-bold text-content mb-3">{h}</h3>
        <p className="text-content-secondary text-sm md:text-base mb-6 max-w-lg mx-auto">{b}</p>
        <a
          href={LANDING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-orange-500 text-white rounded-xl font-bold text-sm md:text-base shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
        >
          {cta}
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  if (variant === 'compact') {
    const h = headline || 'Track your own content';
    const cta = buttonLabel || 'Try ViewTrack';
    return (
      <div className="flex items-center justify-between gap-4 bg-surface-secondary border border-border rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-content flex-1 min-w-0 truncate">{h}</p>
        <a
          href={LANDING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all whitespace-nowrap"
        >
          {cta}
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // Default "full" variant: mid-page banner with emphasis
  const h = headline || 'Track your content with ViewTrack';
  const b = body || 'Monitor accounts, track videos, and measure growth across TikTok, Instagram, YouTube, and X, all in one dashboard.';
  const cta = buttonLabel || 'Start Free';

  return (
    <div className="relative overflow-hidden bg-content rounded-2xl p-8 md:p-10 border border-border">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl md:text-2xl font-bold text-content-inverse mb-2">{h}</h3>
          <p className="text-content-inverse/70 text-sm md:text-base">{b}</p>
        </div>
        <a
          href={LANDING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 self-start md:self-center inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm md:text-base shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all whitespace-nowrap"
        >
          {cta}
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

export default LandingCTABanner;
