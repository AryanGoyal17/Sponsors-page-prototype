// SponsorsOrbPage.jsx
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SponsorOrbCanvas from "./SponsorOrbCanvas";
import SponsorModal from "./SponsorModal";
import { sponsorsData } from "./sponsors";
import "./SponsorsOrbPage.css";

gsap.registerPlugin(ScrollTrigger);

const SCROLL_ROTATIONS = 1.25;

export default function SponsorsOrbPage() {
  const [activeSponsor, setActiveSponsor] = useState(null);
  const trackRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipLabelRef = useRef(null);
  const scrollRotationRef = useRef(0);
  const hoveredSponsorRef = useRef(null);

  useEffect(() => {
    // We create a master timeline for the whole pinned section
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: trackRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6, 
        pin: ".sponsor-orb-stage",
        onUpdate: (self) => {
          // The orb continuously rotates throughout the entire scroll
          scrollRotationRef.current = self.progress * Math.PI * 2 * SCROLL_ROTATIONS;
        },
      }
    });

    // PHASE 1: The first 15% of the scroll fades the text up and clears the blur
    tl.to(".sponsor-hero", { 
      opacity: 0, 
      y: -100, // Slides up 100px while fading
      duration: 0.15, 
      ease: "power2.inOut" 
    }, 0)
    .to(".canvas-blur-wrapper", { 
      filter: "blur(0px) brightness(1)", 
      duration: 0.15, 
      ease: "power2.inOut" 
    }, 0)
    // PHASE 2: Dummy tween to pad out the remaining 85% of the scroll distance for pure rotation
    .to({}, { duration: 0.85 });

    return () => {
      tl.kill();
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

  const handleViewClick = () => {
    if (hoveredSponsorRef.current) setActiveSponsor(hoveredSponsorRef.current);
  };

  return (
    <div ref={trackRef} className="sponsor-scroll-track">
      <section className="sponsor-orb-stage">
        
        {/* NEW: The cinematic overlay text */}
        <div className="sponsor-hero">
          <h3 className="sponsor-hero-subtitle">LEARN • EMERGE • ASPIRE • DISCOVER</h3>
          <h1 className="sponsor-hero-title">OUR NETWORK</h1>
          <p className="sponsor-hero-desc">The incredible partners powering the future of LEAD.</p>
        </div>

        {/* NEW: Wrapper that handles the initial blur and dimming */}
        <div className="canvas-blur-wrapper">
          <SponsorOrbCanvas
            sponsors={sponsorsData}
            onSelectSponsor={setActiveSponsor}
            onHoverFrame={handleHoverFrame}
            scrollRotationRef={scrollRotationRef}
          />
        </div>

        <div ref={tooltipRef} className="sponsor-orb-tooltip" aria-hidden="true">
          <span ref={tooltipLabelRef} className="sponsor-orb-tooltip-name" />
          <button
            type="button"
            className="sponsor-orb-tooltip-view"
            onClick={handleViewClick}
            tabIndex={-1}
          >
            View
          </button>
        </div>

        <SponsorModal sponsor={activeSponsor} onClose={() => setActiveSponsor(null)} />
      </section>
    </div>
  );
}