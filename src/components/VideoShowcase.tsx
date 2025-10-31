import { useRef, useState, useEffect } from "react";
import { Play } from "lucide-react";
import dashboardImg from '/dashboard.png';

type VideoShowcaseProps = {
  src: string;            // e.g. "/demo/overview.mp4"
  poster?: string;        // e.g. "/demo/poster.jpg"
  caption?: string;       // small text under frame
  className?: string;
};

export default function VideoShowcase({
  src,
  poster = dashboardImg,
  caption = "Overview · ViewTrack",
  className = "",
}: VideoShowcaseProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    
    // try autoplay on mount
    const play = async () => {
      try { 
        await v.play(); 
        setIsPlaying(true); 
      } catch { 
        setIsPlaying(false); 
      }
    };
    
    play();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const toggle = async () => {
    const v = ref.current;
    if (!v) return;
    
    if (v.paused) { 
      await v.play(); 
      setIsPlaying(true); 
    } else { 
      v.pause(); 
      setIsPlaying(false); 
    }
  };

  return (
    <section
      aria-label="Product demo"
      className={`relative mx-auto w-full max-w-6xl px-4 ${className}`}
    >
      {/* Frame */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-3xl shadow-xl cursor-pointer" 
        style={{ aspectRatio: '16/10' }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={toggle}
      >
        {/* Subtle outer glow */}
        <div 
          className="pointer-events-none absolute inset-0 rounded-3xl z-10"
          style={{ 
            boxShadow: "0 30px 120px rgba(0,0,0,0.35) inset" 
          }} 
        />
        
        {/* Video with taller aspect ratio */}
        <video
          ref={ref}
          className="block w-full h-full object-cover"
          src={src}
          poster={poster}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
        
        {/* Bottom fade to page background (#FAFAFB). */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 z-10"
          style={{ 
            backgroundImage: "linear-gradient(to bottom, rgba(250,250,251,0), #FAFAFB 72%)" 
          }}
        />
        
        {/* Mouse-following play button */}
        {isHovering && (
          <div
            className="absolute pointer-events-none z-20 transition-opacity duration-300"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-md shadow-2xl flex items-center justify-center">
              <Play className="w-8 h-8 text-gray-900 fill-gray-900 ml-1" />
            </div>
          </div>
        )}
      </div>
      
      {/* Caption */}
      <p className="mx-auto mt-3 text-center text-sm text-gray-500">{caption}</p>
    </section>
  );
}

