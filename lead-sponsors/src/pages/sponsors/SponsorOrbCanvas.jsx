// SponsorOrbCanvas.jsx
// -----------------------------------------------------------------------------
// Self-contained, directly-interactive Three.js orb for the Sponsors page.
//
// Visual construction (glow sprite, icosahedron core, two wire shells, ambient
// particle cloud, exact colors) is forked from the provided OrbCanvas.jsx —
// same aesthetic, verbatim palette. What's different, deliberately:
//
//   - Sized to its own container via ResizeObserver, not `window`. The
//     original was a global fixed-position background; this canvas is a
//     standalone interactive element and needs to be portable into any
//     container size.
//   - No orbStateRef / execSignalRef scroll-driven state machine — this page
//     isn't scrolling through Home/Exec/Dept sections, so useOrbState.js's
//     machinery doesn't apply here. A much simpler one-shot entrance ease
//     replaces it (see `entranceT` below).
//   - No window-mousemove parallax tilt. Rotation is now fully driven by
//     pointer drag + inertia, plus a gentle constant ambient auto-rotate
//     when idle. Keeping the old parallax on top would fight the user's
//     drag input and desync the raycasting hover from what's visually under
//     the cursor.
//   - Adds: sponsor node sprites (logo-or-initials on a glow badge matching
//     the shell palette), pointer-drag rotation with momentum, raycasting
//     for hover + click, and per-frame hover-position callbacks for a DOM
//     tooltip (see SponsorsOrbPage.jsx for why that's ref-driven, not state).
//
// Props:
//   sponsors        — [{ id, name, logoUrl, blurb, link }], read once at
//                      mount (see note below — this assumes a static list).
//   onSelectSponsor  — (sponsor) => void, fired on a confirmed click (not a drag)
//   onHoverFrame     — ({ sponsor, x, y } | null) => void, fired every frame
//                      while a node is hovered, and once with null on hover-out.
//                      Passes the full sponsor record (not just id/name) so the
//                      page can wire a "View" button straight to onSelectSponsor
//                      without a second lookup.
//   verticalOffset   — number, matches the original file's `group.position.y`
//                      convention (e.g. pass -1 to match the Home hero). Default 0.
//   scrollRotationRef — optional ref<number>, radians. The page updates
//                      `.current` (e.g. from a GSAP ScrollTrigger onUpdate)
//                      and this component applies the *delta* to group.rotation.y
//                      every frame, on top of drag/inertia/ambient rotation —
//                      same additive model, just a third input into the same
//                      accumulator, so it composes for free.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./SponsorOrbCanvas.css";

const NODE_RADIUS = 2.6;        // sits just outside the outer wire shell (2.5), inside the particle field (2.8+)
const BASE_NODE_SCALE = 0.55;
const HOVER_NODE_SCALE = 0.72;
const NODE_SCALE_LERP = 0.18;

const DRAG_SENSITIVITY = 0.006;
const CLICK_THRESHOLD_PX = 6;   // total pointer movement below this = click, not drag
const INERTIA_DAMPING = 0.93;   // per-frame velocity decay after release
const AMBIENT_SPEED = 0.05;     // radians/sec baseline auto-rotate when idle
const MAX_PITCH = 1.0;          // clamp vertical rotation so the orb can't flip disorientingly

const ENTRANCE_DURATION = 1.2;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function fibonacciPoint(i, count, radius) {
  const t = i / count;
  const phi = Math.acos(1 - 2 * t);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// Draws the node's badge: a glow-tinted circle (matching the shell palette)
// with either the loaded logo image or initials as a fallback/loading state.
function paintNodeFace(ctx, size, sponsor, img) {
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(15, 30, 40, 0.95)");
  grad.addColorStop(0.72, "rgba(20, 50, 65, 0.9)");
  grad.addColorStop(1, "rgba(63, 227, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(159, 243, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.stroke();

  if (img) {
    const logoSize = size * 0.5;
    ctx.drawImage(img, c - logoSize / 2, c - logoSize / 2, logoSize, logoSize);
  } else {
    ctx.fillStyle = "rgba(159, 243, 255, 0.9)";
    ctx.font = `700 ${size * 0.22}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(sponsor.name), c, c + 2);
  }
}

function createSponsorSprite(sponsor) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  paintNodeFace(ctx, size, sponsor, null);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BASE_NODE_SCALE, BASE_NODE_SCALE, 1);
  sprite.userData.sponsor = sponsor;
  sprite.userData.targetScale = BASE_NODE_SCALE;

  if (sponsor.logoUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      paintNodeFace(ctx, size, sponsor, img);
      texture.needsUpdate = true;
    };
    img.onerror = () => {
      /* keep the initials fallback already painted */
    };
    img.src = sponsor.logoUrl;
  }

  return sprite;
}

export default function SponsorOrbCanvas({
  sponsors,
  onSelectSponsor,
  onHoverFrame,
  verticalOffset = 0,
  scrollRotationRef,
}) {
  const canvasRef = useRef(null);

  // Latest callbacks reachable inside the one-time effect below without
  // re-running WebGL setup on every render (same pattern used throughout
  // this thread — callbacks in refs, Three.js objects never in React state).
  const sponsorsRef = useRef(sponsors);
  const onSelectRef = useRef(onSelectSponsor);
  const onHoverFrameRef = useRef(onHoverFrame);
  sponsorsRef.current = sponsors;
  onSelectRef.current = onSelectSponsor;
  onHoverFrameRef.current = onHoverFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement ?? canvas;
    let w = container.clientWidth || 1;
    let h = container.clientHeight || 1;

    // --- Scene / Camera / Renderer -------------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);

    const group = new THREE.Group();
    scene.add(group);
    group.position.y = verticalOffset;

    // --- Glow sprite (verbatim from OrbCanvas.jsx) ----------------------
    function makeGlowTexture() {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(120,240,255,0.9)");
      grad.addColorStop(0.4, "rgba(63,227,255,0.35)");
      grad.addColorStop(1, "rgba(63,227,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    }

    const glowTex = makeGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(7.5, 7.5, 1);
    group.add(glowSprite);

    // --- Core + wire shells (verbatim) ----------------------------------
    const coreGeo = new THREE.IcosahedronGeometry(1.55, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x1c5f73, transparent: true, opacity: 0.5 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const shellGeo1 = new THREE.IcosahedronGeometry(1.95, 1);
    const wireMat1 = new THREE.LineBasicMaterial({ color: 0x3fe3ff, transparent: true, opacity: 0.55 });
    const wire1 = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo1), wireMat1);
    group.add(wire1);

    const shellGeo2 = new THREE.IcosahedronGeometry(2.5, 1);
    const wireMat2 = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 });
    const wire2 = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo2), wireMat2);
    group.add(wire2);

    // --- Ambient particle cloud (verbatim distribution) -----------------
    const PCOUNT = 420;
    const positions = new Float32Array(PCOUNT * 3);
    for (let i = 0; i < PCOUNT; i++) {
      const r = 2.8 + Math.random() * 2.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x9bf3ff,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    group.add(points);

    // --- Sponsor nodes ----------------------------------------------------
    // Static list assumption: nodes are built once at mount from whatever
    // `sponsors` was on first render. If your sponsor list can change after
    // mount, this component would need to diff and rebuild nodes — out of
    // scope for the prototype phase.
    const nodeGroup = new THREE.Group();
    group.add(nodeGroup);

    const nodes = sponsorsRef.current.map((sponsor, i) => {
      const sprite = createSponsorSprite(sponsor);
      sprite.position.copy(fibonacciPoint(i, sponsorsRef.current.length, NODE_RADIUS));
      nodeGroup.add(sprite);
      return sprite;
    });

    // --- Drag-to-rotate + inertia + raycasting hover/click ----------------
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const worldPos = new THREE.Vector3();

    function pickAtClient(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(nodes, false);
      return hits.length ? hits[0].object : null;
    }

    function projectToScreen(object) {
      object.getWorldPosition(worldPos);
      worldPos.project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: (worldPos.x * 0.5 + 0.5) * rect.width,
        y: (-worldPos.y * 0.5 + 0.5) * rect.height,
      };
    }

    let isDragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    let movedDistance = 0;
    let velocityY = 0;
    let velocityX = 0;
    let lastClientX = null;
    let lastClientY = null;
    let hoveredSponsor = null;

    function updateHover(sponsor) {
      if (hoveredSponsor?.id === sponsor?.id) return;
      hoveredSponsor = sponsor;
      nodes.forEach((n) => {
        n.userData.targetScale = n.userData.sponsor.id === sponsor?.id ? HOVER_NODE_SCALE : BASE_NODE_SCALE;
      });
      if (!sponsor) onHoverFrameRef.current?.(null);
    }

    const handlePointerDown = (event) => {
      isDragging = true;
      pointerId = event.pointerId;
      canvas.setPointerCapture(pointerId);
      lastX = event.clientX;
      lastY = event.clientY;
      movedDistance = 0;
      velocityX = 0;
      velocityY = 0;
      canvas.style.cursor = "grabbing";
    };

    const handlePointerMove = (event) => {
      lastClientX = event.clientX;
      lastClientY = event.clientY;

      if (isDragging && event.pointerId === pointerId) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        movedDistance += Math.abs(dx) + Math.abs(dy);

        velocityY = dx * DRAG_SENSITIVITY;
        velocityX = dy * DRAG_SENSITIVITY;

        group.rotation.y += velocityY;
        group.rotation.x = clamp(group.rotation.x + velocityX, -MAX_PITCH, MAX_PITCH);
      }
    };

    const handlePointerUp = (event) => {
      if (!isDragging || event.pointerId !== pointerId) return;
      isDragging = false;
      canvas.releasePointerCapture(pointerId);

      if (movedDistance < CLICK_THRESHOLD_PX) {
        const hit = pickAtClient(event.clientX, event.clientY);
        if (hit) onSelectRef.current?.(hit.userData.sponsor);
      }
      // else: velocityX/velocityY carry on as inertia, decayed in the render loop
      canvas.style.cursor = hoveredSponsor ? "pointer" : "grab";
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    // --- Resize: observe the container, not window -----------------------
    const resize = () => {
      w = container.clientWidth;
      h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // --- Animation loop -----------------------------------------------
    const clock = new THREE.Clock();
    let lastElapsed = 0;
    let lastScrollRotation = 0;
    let frameId;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const dt = t - lastElapsed;
      lastElapsed = t;

      const entranceT = easeOutCubic(clamp(t / ENTRANCE_DURATION, 0, 1));

      // Scroll-linked rotation: scrollRotationRef.current is an absolute
      // target angle driven by scroll progress (see SponsorsOrbPage's
      // ScrollTrigger), not a delta. We diff against the last frame's value
      // and add just that delta to group.rotation.y, so it composes with
      // drag/inertia/ambient spin on the same accumulator instead of
      // fighting them — scroll up and the orb un-rotates by exactly as
      // much as it rotated on the way down.
      if (scrollRotationRef) {
        const currentScrollRotation = scrollRotationRef.current ?? 0;
        group.rotation.y += currentScrollRotation - lastScrollRotation;
        lastScrollRotation = currentScrollRotation;
      }

      if (!isDragging) {
        velocityY *= INERTIA_DAMPING;
        velocityX *= INERTIA_DAMPING;
        group.rotation.y += velocityY + AMBIENT_SPEED * dt;
        group.rotation.x = clamp(group.rotation.x + velocityX, -MAX_PITCH, MAX_PITCH);

        // Continuously re-pick hover using the last known pointer position —
        // the orb keeps spinning (ambient/inertia) even when the pointer
        // itself is still, so hover has to be re-evaluated every frame,
        // not only on pointermove.
        if (lastClientX !== null) {
          const hit = pickAtClient(lastClientX, lastClientY);
          updateHover(hit?.userData.sponsor ?? null);
          canvas.style.cursor = hit ? "pointer" : "grab";
        }
      }

      points.rotation.y = -t * 0.05;
      wire1.rotation.y = t * 0.04;
      wire2.rotation.x = t * 0.03;

      const pulse = 1 + Math.sin(t * 1.6) * 0.04;
      core.scale.setScalar(pulse);

      nodes.forEach((n) => {
        n.scale.x += (n.userData.targetScale - n.scale.x) * NODE_SCALE_LERP;
        n.scale.y = n.scale.x;
      });

      group.scale.setScalar(0.6 + 0.4 * entranceT);
      wire1.material.opacity = 0.55 * entranceT;
      wire2.material.opacity = 0.25 * entranceT;
      points.material.opacity = 0.85 * entranceT;
      core.material.opacity = 0.5 * entranceT;
      glowSprite.material.opacity = entranceT;
      glowSprite.scale.setScalar(7.5 + Math.sin(t * 1.2) * 0.4);

      if (hoveredSponsor) {
        const node = nodes.find((n) => n.userData.sponsor.id === hoveredSponsor.id);
        if (node) {
          const screen = projectToScreen(node);
          onHoverFrameRef.current?.({ sponsor: hoveredSponsor, ...screen });
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);

      glowTex.dispose();
      glowMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      shellGeo1.dispose();
      wireMat1.dispose();
      shellGeo2.dispose();
      wireMat2.dispose();
      pGeo.dispose();
      pMat.dispose();
      nodes.forEach((n) => {
        n.material.map?.dispose();
        n.material.dispose();
      });
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalOffset]);

  return <canvas ref={canvasRef} className="sponsor-orb-canvas" />;
}