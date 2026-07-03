// SponsorsOrbPage.jsx
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SponsorOrbCanvas from "./SponsorOrbCanvas";
import SponsorModal from "./SponsorModal";
import { sponsorsData } from "./sponsors";
import "./SponsorsOrbPage.css";

gsap.registerPlugin(ScrollTrigger);

export default function SponsorsOrbPage() {
  const [activeSponsor, setActiveSponsor] = useState(null);
  
  const stageRef = useRef(null); 
  const tooltipRef = useRef(null);
  const tooltipLabelRef = useRef(null);
  
  const scrollRotationRef = useRef({ current: 0 });
  const hoveredSponsorRef = useRef(null);

  useEffect(() => {
    const numSponsors = sponsorsData.length;
    
    // Pin the stage and scrub the rotation based on scroll depth
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stageRef.current,
        start: "top top",
        end: `+=${numSponsors * 120}%`, // Scroll distance (120% per sponsor)
        scrub: 1.2,
        pin: true,
        snap: {
          snapTo: "labels",
          duration: { min: 0.3, max: 0.8 },
          delay: 0.1,
          ease: "power1.inOut"
        }
      }
    });

    const stepAngle = (Math.PI * 2) / numSponsors;

    // Build the pause-and-snap rotation timeline
    for (let i = 0; i < numSponsors; i++) {
      const currentAngle = -(stepAngle * i);
      const nextAngle = -(stepAngle * (i + 1));

      tl.addLabel(`sponsor-${i}`);

      // Pause on the current sponsor
      tl.to(scrollRotationRef.current, { 
        current: currentAngle, 
        duration: 2, 
        ease: "none" 
      });

      // Rotate to the next sponsor
      tl.to(scrollRotationRef.current, { 
        current: nextAngle, 
        duration: 1, 
        ease: "power2.inOut" 
      });
    }

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  // Update tooltip position and content dynamically (works for mobile auto-focus too)
  const handleHoverFrame = (info) => {
    const el = tooltipRef.current;
    if (!el) return;

    if (!info) {
      hoveredSponsorRef.current = null;
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      return;
    }

    hoveredSponsorRef.current = info.sponsor;
    el.style.opacity = "1";
    el.style.pointerEvents = "auto"; // Makes the view button clickable
    
    // Position the tooltip slightly above the node
    el.style.transform = `translate3d(${info.x}px, ${info.y}px, 0) translate(-50%, calc(-100% - 20px))`;
    
    if (tooltipLabelRef.current) {
      tooltipLabelRef.current.textContent = info.sponsor.name;
    }
  };

  return (
    <section ref={stageRef} className="sponsor-orb-stage">
      <SponsorOrbCanvas
        sponsors={sponsorsData}
        onHoverFrame={handleHoverFrame}
        scrollRotationRef={scrollRotationRef}
      />

      <div ref={tooltipRef} className="sponsor-orb-tooltip" aria-hidden="true">
        <span ref={tooltipLabelRef} className="sponsor-orb-tooltip-name" />
        <button
          type="button"
          className="sponsor-orb-tooltip-view"
          onClick={() => setActiveSponsor(hoveredSponsorRef.current)}
        >
          View
        </button>
      </div>

      <SponsorModal sponsor={activeSponsor} onClose={() => setActiveSponsor(null)} />
    </section>
  );
}