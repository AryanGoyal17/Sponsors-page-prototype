// SponsorModal.jsx
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./SponsorModal.css";

export default function SponsorModal({ sponsor, onClose }) {
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const [displaySponsor, setDisplaySponsor] = useState(null);
  
  const isOpen = Boolean(sponsor);

  // THE FIX: Derived State. 
  // This forces React to render the panel into the DOM *before* the GSAP useEffect fires.
  if (sponsor && sponsor !== displaySponsor) {
    setDisplaySponsor(sponsor);
  }

  useEffect(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    
    // Safety check
    if (!backdrop || !panel) return;

    // Stop any animations currently happening
    gsap.killTweensOf([backdrop, panel]);

    if (isOpen) {
      // 1. Unhide the backdrop
      gsap.set(backdrop, { display: "flex" });
      
      // 2. Animate background blur in
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      
      // 3. Animate the popup panel scaling up
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }
      );
    } else if (displaySponsor) {
      // Animate the panel closing
      gsap.to(panel, { opacity: 0, scale: 0.9, y: 20, duration: 0.2, ease: "power2.in" });
      
      // Fade out background and remove from DOM
      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(backdrop, { display: "none" });
          // Clear the data only AFTER it finishes fading out
          setDisplaySponsor(null);
        },
      });
    }
  }, [isOpen, displaySponsor]);

  // Allow closing the popup by pressing the Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Clean up animations if component unmounts
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
      {/* displaySponsor is now guaranteed to be ready, meaning panelRef exists for GSAP */}
      {displaySponsor && (
        <div ref={panelRef} className="sponsor-modal-panel">
          <button type="button" className="sponsor-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          
          <div className="sponsor-modal-logo-container">
            {displaySponsor.logoUrl ? (
              <img src={displaySponsor.logoUrl} alt={displaySponsor.name} className="sponsor-modal-img" />
            ) : (
              <span className="sponsor-modal-placeholder">{displaySponsor.name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}