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
  
  // We now reference the stage directly, no more track container
  const stageRef = useRef(null); 
  const tooltipRef = useRef(null);
  const tooltipLabelRef = useRef(null);
  
  const scrollRotationRef = useRef({ current: 0 });
  const hoveredSponsorRef = useRef(null);

  useEffect(() => {
    const numSponsors = sponsorsData.length;
    
    // 1. Let GSAP perfectly pin the stage and calculate the scroll distance automatically
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stageRef.current, // Target the 100vh element
        start: "top top",
        end: `+=${numSponsors * 150}%`, // Scroll for X times the viewport height
        scrub: 1.5,
        pin: true, // GSAP will automatically wrap this and lock it perfectly centered
        snap: {
          snapTo: "labels",
          duration: { min: 0.3, max: 0.8 },
          delay: 0.1,
          ease: "power1.inOut"
        }
      }
    });

    const stepAngle = (Math.PI * 2) / numSponsors;

    // 2. Build the precise Pause & Move timeline
    for (let i = 0; i < numSponsors; i++) {
      const currentAngle = -(stepAngle * i);
      const nextAngle = -(stepAngle * (i + 1));

      tl.addLabel(`sponsor-${i}`);

      tl.to(scrollRotationRef.current, { 
        current: currentAngle, 
        duration: 2, 
        ease: "none" 
      });

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
    el.style.pointerEvents = "auto";
    el.style.transform = `translate3d(${info.x}px, ${info.y}px, 0) translate(-50%, calc(-100% - 14px))`;
    if (tooltipLabelRef.current) tooltipLabelRef.current.textContent = info.sponsor.name;
  };

  return (
    // We completely removed the outer <div className="sponsor-scroll-track"> wrapper!
    // The <section> is now the top-level element and the GSAP trigger.
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