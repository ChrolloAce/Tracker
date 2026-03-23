import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface SpotlightStep {
  target: string; // CSS selector, or 'center' for centered modal
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  padding?: number;
  ctaLabel?: string;
  expandSection?: string; // CSS selector of a section header to click/expand before highlighting
}

interface SpotlightOnboardingProps {
  steps: SpotlightStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const SpotlightOnboarding: React.FC<SpotlightOnboardingProps> = ({
  steps,
  isActive,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const scrollLockRef = useRef(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = step?.target === 'center';

  // Lock scrolling and navigation when spotlight is active
  useEffect(() => {
    if (!isActive) {
      scrollLockRef.current = false;
      return;
    }

    scrollLockRef.current = true;

    // Block scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Block keyboard navigation
    const handleKeydown = (e: KeyboardEvent) => {
      // Allow Escape to skip
      if (e.key === 'Escape') {
        onSkip();
        return;
      }
      // Allow Enter/Space to advance
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNext();
        return;
      }
      // Block Tab and arrow keys
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };

    // Block click on links/buttons behind overlay
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow clicks on our spotlight UI
      if (target.closest('[data-spotlight-ui]')) return;
      // Block everything else
      if (!target.closest('[data-spotlight-ui]')) {
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive]);

  const updatePosition = useCallback(() => {
    if (!step) return;

    if (step.target === 'center') {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const padding = step.padding ?? 8;
    const tooltipWidth = 360;
    const tooltipHeight = 180;
    const gap = 16;
    const pos = step.position || 'bottom';

    let top = 0;
    let left = 0;

    switch (pos) {
      case 'bottom':
        top = rect.bottom + padding + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - padding - gap - tooltipHeight;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - padding - gap - tooltipWidth;
        break;
    }

    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) left = window.innerWidth - tooltipWidth - 16;
    if (top < 16) top = 16;
    if (top + tooltipHeight > window.innerHeight - 16) top = window.innerHeight - tooltipHeight - 16;

    setTooltipPos({ top, left });
  }, [step]);

  // Expand sidebar sections if needed, then position
  useEffect(() => {
    if (!isActive || !step) return;

    // If step needs a section expanded first, click it
    if (step.expandSection) {
      const sectionBtn = document.querySelector(step.expandSection) as HTMLElement;
      if (sectionBtn) {
        // Check if the section's items are hidden (collapsed)
        const parentDiv = sectionBtn.closest('[class*="space-y"]');
        const itemsContainer = parentDiv?.querySelector('.space-y-1.pl-2');
        if (!itemsContainer) {
          sectionBtn.click();
        }
      }
    }

    const timer = setTimeout(() => {
      updatePosition();
      setIsAnimating(false);
    }, 200);

    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStep, step, updatePosition]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setIsAnimating(true);
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isActive || !step) return null;

  const padding = step.padding ?? 8;

  return createPortal(
    <div className="fixed inset-0 z-[99998]" data-spotlight-ui>
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={12}
                ry={12}
                fill="black"
                style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.82)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {/* Subtle glow ring around target */}
      {targetRect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            left: targetRect.left - padding,
            top: targetRect.top - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 0 20px rgba(0, 123, 255, 0.15)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        data-spotlight-ui
        className={isCentered
          ? 'fixed inset-0 flex items-center justify-center pointer-events-auto'
          : 'absolute pointer-events-auto'
        }
        style={isCentered ? {} : {
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        <div
          style={{
            width: isCentered ? 420 : 360,
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? 'translateY(10px) scale(0.98)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          <div
            className="rounded-2xl shadow-2xl"
            style={{
              padding: isCentered ? 28 : 20,
              background: isCentered
                ? 'linear-gradient(135deg, #0D0D0D 0%, #141414 100%)'
                : '#111111',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Step indicator dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    height: 4,
                    width: i === currentStep ? 24 : 12,
                    background: i === currentStep
                      ? 'linear-gradient(90deg, #007BFF, #2583FF)'
                      : i < currentStep
                      ? 'rgba(0, 123, 255, 0.35)'
                      : 'rgba(255, 255, 255, 0.06)',
                  }}
                />
              ))}
              <span className="ml-auto text-[11px] text-white/25 font-medium tabular-nums">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            {/* Content */}
            <h3
              className="text-white font-semibold tracking-tight mb-1.5"
              style={{ fontSize: isCentered ? 18 : 15 }}
            >
              {step.title}
            </h3>
            <p
              className="text-white/45 leading-relaxed mb-5"
              style={{ fontSize: isCentered ? 14 : 13 }}
            >
              {step.description}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-3 py-1.5 text-[13px] text-white/35 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={onSkip}
                  className="px-3 py-1.5 text-[13px] text-white/25 hover:text-white/45 transition-colors rounded-lg hover:bg-white/5"
                >
                  Skip
                </button>
              </div>
              <button
                onClick={handleNext}
                className="text-white font-semibold rounded-lg transition-all duration-200 hover:brightness-110"
                style={{
                  padding: isCentered ? '10px 28px' : '8px 20px',
                  fontSize: isCentered ? 14 : 13,
                  background: 'linear-gradient(135deg, #007BFF 0%, #2583FF 100%)',
                  boxShadow: '0 2px 12px rgba(0, 123, 255, 0.25)',
                }}
              >
                {step.ctaLabel || (isLastStep ? 'Get Started' : 'Next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SpotlightOnboarding;
