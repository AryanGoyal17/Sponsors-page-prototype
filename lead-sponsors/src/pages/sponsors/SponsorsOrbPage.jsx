// SponsorsOrbPage.jsx
// -----------------------------------------------------------------------------
// Composes the orb canvas + hover tooltip + click modal.
//
// Note the tooltip: SponsorOrbCanvas calls `onHoverFrame` up to 60x/sec while
// a node is hovered (it needs to track the node's screen position as the orb
// keeps rotating). Routing that through setState would re-render this whole
// page every frame — so instead we hold a ref to the tooltip DOM node and
// mutate its style directly. `activeSponsor` (click-driven, fires rarely) is
// the only piece that's normal React state.
// -----------------------------------------------------------------------------

import { useRef, useState } from "react";
import SponsorOrbCanvas from "./SponsorOrbCanvas";
import SponsorModal from "./SponsorModal";
import { sponsorsSample } from "./sponsors.sample";
import "./SponsorsOrbPage.css";

export default function SponsorsOrbPage() {
  const [activeSponsor, setActiveSponsor] = useState(null);
  const tooltipRef = useRef(null);

  const handleHoverFrame = (info) => {
    const el = tooltipRef.current;
    if (!el) return;
    if (!info) {
      el.style.opacity = "0";
      return;
    }
    el.style.opacity = "1";
    el.style.transform = `translate3d(${info.x}px, ${info.y}px, 0) translate(-50%, calc(-100% - 14px))`;
    el.textContent = info.name;
  };

  return (
    <section className="sponsor-orb-stage">
      <SponsorOrbCanvas
        sponsors={sponsorsSample}
        onSelectSponsor={setActiveSponsor}
        onHoverFrame={handleHoverFrame}
      />

      <div ref={tooltipRef} className="sponsor-orb-tooltip" aria-hidden="true" />

      <SponsorModal sponsor={activeSponsor} onClose={() => setActiveSponsor(null)} />
    </section>
  );
}
