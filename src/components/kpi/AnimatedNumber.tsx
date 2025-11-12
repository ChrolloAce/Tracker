import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber Component
 * Smoothly animates number changes with support for formatted values (K, M, %, $)
 */
export const AnimatedNumber: React.FC<{ value: string | number; className?: string }> = React.memo(({ value, className }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const parseFormattedNumber = (val: string | number): { numeric: number; suffix: string; prefix: string } => {
      if (typeof val === 'number') return { numeric: val, suffix: '', prefix: '' };
      
      const str = String(val).trim();
      
      // Handle percentage
      if (str.includes('%')) {
        const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
        return { numeric: isNaN(num) ? 0 : num, suffix: '%', prefix: '' };
      }
      
      // Handle currency
      if (str.startsWith('$')) {
        const cleaned = str.substring(1);
        if (cleaned.endsWith('K')) {
          const num = parseFloat(cleaned.replace('K', ''));
          return { numeric: isNaN(num) ? 0 : num, suffix: 'K', prefix: '$' };
        }
        if (cleaned.endsWith('M')) {
          const num = parseFloat(cleaned.replace('M', ''));
          return { numeric: isNaN(num) ? 0 : num, suffix: 'M', prefix: '$' };
        }
        const num = parseFloat(cleaned);
        return { numeric: isNaN(num) ? 0 : num, suffix: '', prefix: '$' };
      }
      
      // Handle K/M suffixes
      if (str.endsWith('K')) {
        const num = parseFloat(str.replace('K', ''));
        return { numeric: isNaN(num) ? 0 : num, suffix: 'K', prefix: '' };
      }
      if (str.endsWith('M')) {
        const num = parseFloat(str.replace('M', ''));
        return { numeric: isNaN(num) ? 0 : num, suffix: 'M', prefix: '' };
      }
      
      // Plain number
      const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
      return { numeric: isNaN(num) ? 0 : num, suffix: '', prefix: '' };
    };

    const current = parseFormattedNumber(value);
    const previous = parseFormattedNumber(prevValueRef.current);

    // If same value, no animation needed
    if (current.numeric === previous.numeric && current.suffix === previous.suffix && current.prefix === previous.prefix) {
      setDisplayValue(value);
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    // If we're changing the value WHILE animating, skip to final value immediately
    // This prevents the "pause" effect when data updates rapidly
    if (isAnimatingRef.current) {
      setDisplayValue(value);
      prevValueRef.current = value;
      isAnimatingRef.current = false;
      return;
    }

    // Start new animation
    isAnimatingRef.current = true;
    const duration = 300; // ms - faster animation
    const steps = 15; // fewer steps for snappier feel
    const stepValue = (current.numeric - previous.numeric) / steps;
    const stepDuration = duration / steps;
    let currentStep = 0;

    animationRef.current = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        if (animationRef.current) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }
        prevValueRef.current = value;
        isAnimatingRef.current = false;
      } else {
        const interpolated = previous.numeric + (stepValue * currentStep);
        const rounded = current.suffix ? interpolated.toFixed(1) : Math.round(interpolated);
        setDisplayValue(`${current.prefix}${rounded}${current.suffix}`);
      }
    }, stepDuration);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      isAnimatingRef.current = false;
    };
  }, [value]);

  return <span className={className}>{displayValue}</span>;
});

AnimatedNumber.displayName = 'AnimatedNumber';

