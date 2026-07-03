// SponsorsOrbPage.jsx
// -----------------------------------------------------------------------------
// Composes the orb canvas + hover tooltip/View button + click modal + the
// scroll track that drives rotation.
//
// Two ref-driven channels feed the canvas every frame, neither touches React
// state (see SponsorOrbCanvas's `onHoverFrame` note — routing 60fps updates
// through setState would re-render this whole page every frame):
//   - scrollRotationRef: written by a GSAP ScrollTrigger onUpdate callback,
//     read by the canvas's animate loop.
//   - tooltipRef / hoveredSponsorRef: written by handleHoverFrame (called by
//     the canvas), read by the DOM directly and by the View button's click
//     handler.
// `activeSponsor` (click-driven, fires rarely) is the only piece that's
// normal React state.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SponsorOrbCanvas from "./SponsorOrbCanvas";
import SponsorModal from "./SponsorModal";
import { sponsorsSample } from "./sponsors.sample";
import "./SponsorsOrbPage.css";

gsap.registerPlugin(ScrollTrigger);

// Full turns the orb makes across the entire scroll track. Raise this (or
// shorten .sponsor-scroll-track's height in the CSS) for faster rotation
// per pixel scrolled.
const SCROLL_ROTATIONS = 1.25;

export default function SponsorsOrbPage() {
  const [activeSponsor, setActiveSponsor] = useState(null);
  const trackRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipLabelRef = useRef(null);
  const scrollRotationRef = useRef(0);
  const hoveredSponsorRef = useRef(null);

  useEffect(() => {
    // The track's height *is* the scroll distance; "top top" -> "bottom
    // bottom" spans exactly the window during which .sponsor-orb-stage is
    // stuck (position: sticky) to the top of the viewport. No `pin: true`
    // needed — CSS sticky already handles the pinning, ScrollTrigger here
    // is only measuring progress (0 -> 1) across that span.
    const st = ScrollTrigger.create({
      trigger: trackRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6, // small smoothing lag so rotation doesn't feel input-locked
      onUpdate: (self) => {
        scrollRotationRef.current = self.progress * Math.PI * 2 * SCROLL_ROTATIONS;
      },
    });
    return () => st.kill();
  }, []);

  const handleHoverFrame = (info) => {
    const el = tooltipRef.current;
    if (!el) return;

    if (!info) {
      hoveredSponsorRef.current = null;
      el.style.opacity = "0";
      el.style.pointerEvents = "none"; // stop blocking canvas drag/click again
      return;
    }

    hoveredSponsorRef.current = info.sponsor;
    el.style.opacity = "1";
    el.style.pointerEvents = "auto"; // let the View button receive clicks
    el.style.transform = `translate3d(${info.x}px, ${info.y}px, 0) translate(-50%, calc(-100% - 14px))`;
    if (tooltipLabelRef.current) tooltipLabelRef.current.textContent = info.sponsor.name;
  };

  const handleViewClick = () => {
    if (hoveredSponsorRef.current) setActiveSponsor(hoveredSponsorRef.current);
  };

  return (
    <div ref={trackRef} className="sponsor-scroll-track">
      <section className="sponsor-orb-stage">
        <SponsorOrbCanvas
          sponsors={sponsorsSample}
          onSelectSponsor={setActiveSponsor}
          onHoverFrame={handleHoverFrame}
          scrollRotationRef={scrollRotationRef}
        />

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