import React, { useRef, useEffect, useState } from 'react';
import { VideoCard } from './VideoCard';

// Configuration
const CARD_WIDTH = 200;
const CARD_HEIGHT = 340;
const RADIUS = 800;
const ANGLE_PER_CARD = 15; // Increased spacing for better separation
const VISIBLE_COUNT = 6; // Cards visible on each side
const BASE_SPEED = 0.0003; // speed per ms

// Mock Data (13 videos)
const CARDS = Array.from({ length: 13 }).map((_, i) => ({
  id: i + 1,
  views: `${(Math.random() * 5 + 0.8).toFixed(1)}M`
}));

export const VideoCarousel3D: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const reqId = useRef<number>();
  const lastTime = useRef<number>(0);
  const offsetRef = useRef(0); // Use ref for animation loop to avoid closure staleness

  useEffect(() => {
    const animate = (time: number) => {
      if (!lastTime.current) lastTime.current = time;
      const delta = time - lastTime.current;
      
      // Update offset
      offsetRef.current += delta * BASE_SPEED;
      setOffset(offsetRef.current);
      
      lastTime.current = time;
      reqId.current = requestAnimationFrame(animate);
    };
    
    reqId.current = requestAnimationFrame(animate);
    
    return () => {
      if (reqId.current) cancelAnimationFrame(reqId.current);
    };
  }, []);

  // Render Logic
  const centerIndex = Math.floor(offset);
  
  const items = [];
  // Render a wide range to ensure no popping at edges
  for (let i = centerIndex - VISIBLE_COUNT; i <= centerIndex + VISIBLE_COUNT; i++) {
    // Calculate relative position (float)
    const relativeIndex = i - offset;
    
    // Math
    const angleDeg = relativeIndex * ANGLE_PER_CARD;
    const angleRad = (angleDeg * Math.PI) / 180;
    
    // Position Calculation (Concave Cylinder)
    const x = RADIUS * Math.sin(angleRad);
    
    // Concave Logic:
    // Standard cylinder z = R * cos(a). Center is closest (R).
    // To invert: z = R * (1 - cos(a)). Center is 0. Edges are positive (closer).
    // Adjust -100 to push the whole wall back a bit.
    const z = RADIUS * (1 - Math.cos(angleRad)) - 100;
    
    // Rotation:
    // To face the center, we usually rotate -angleDeg.
    const rotateY = -angleDeg;
    
    // Opacity fade at edges
    const distance = Math.abs(relativeIndex);
    const opacity = Math.max(0, 1 - Math.pow(distance / VISIBLE_COUNT, 4)); // Cubic fade
    
    // Data Modulo
    const dataIndex = ((i % CARDS.length) + CARDS.length) % CARDS.length;
    const data = CARDS[dataIndex];

    // Only render if visible (opacity > 0.01)
    if (opacity > 0.01) {
      items.push(
        <div
          key={i}
          className="absolute top-0 left-0 will-change-transform"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            // Centering the card on its pivot
            marginLeft: -CARD_WIDTH / 2,
            marginTop: -CARD_HEIGHT / 2,
            transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rotateY}deg)`,
            opacity,
            zIndex: Math.round(1000 - Math.abs(distance * 10)),
          }}
        >
          <VideoCard id={data.id} views={data.views} />
        </div>
      );
    }
  }

  return (
    <div className="relative w-screen h-[500px] overflow-hidden flex items-center justify-center">
      {/* 3D Stage */}
      <div 
        className="relative w-0 h-0"
        style={{ 
          perspective: '1200px',
          transformStyle: 'preserve-3d'
        }}
      >
        {items}
      </div>
    </div>
  );
};

