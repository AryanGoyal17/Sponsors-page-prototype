// SponsorModal.jsx
// -----------------------------------------------------------------------------
// Glassmorphism popup, animated with GSAP. Note the `displaySponsor` local
// state: when the parent clears `sponsor` (closing the modal), we don't want
// the content to vanish instantly while the backdrop is still fading out —
// so this component keeps rendering the last sponsor until its own exit
// tween finishes, then clears it. The parent's `sponsor` prop only controls
// *when* to animate open/closed, not what's currently painted.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./SponsorModal.css";

export default function SponsorModal({ sponsor, onClose }) {
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const [displaySponsor, setDisplaySponsor] = useState(null);
  const isOpen = Boolean(sponsor);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel) return;

    gsap.killTweensOf([backdrop, panel]);

    if (isOpen) {
      setDisplaySponsor(sponsor);
      gsap.set(backdrop, { display: "flex" });
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" }
      );
    } else if (displaySponsor) {
      gsap.to(panel, { opacity: 0, scale: 0.92, y: 16, duration: 0.25, ease: "power2.in" });
      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.25,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(backdrop, { display: "none" });
          setDisplaySponsor(null);
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Kill any in-flight tweens if the whole modal unmounts mid-animation.
  useEffect(() => {
    return () => gsap.killTweensOf([backdropRef.current, panelRef.current]);
  }, []);

  return (
    <div
      ref={backdropRef}
      className="sponsor-modal-backdrop"
      style={{ display: "none" }}
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      {displaySponsor && (
        <div ref={panelRef} className="sponsor-modal-panel">
          <button type="button" className="sponsor-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <img src={displaySponsor.logoUrl} alt={displaySponsor.name} className="sponsor-modal-logo" />
          <h3>{displaySponsor.name}</h3>
          <p>{displaySponsor.blurb}</p>
          {displaySponsor.link && (
            <a href={displaySponsor.link} target="_blank" rel="noreferrer" className="sponsor-modal-link">
              Visit site →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
