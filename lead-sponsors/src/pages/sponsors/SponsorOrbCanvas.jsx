// SponsorOrbCanvas.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./SponsorOrbCanvas.css";

const NODE_RADIUS = 2.6;
// INCREASED THESE SCALES TO MAKE CIRCLES MUCH BIGGER
const BASE_NODE_SCALE = 0.85; 
const HOVER_NODE_SCALE = 1.15;
const NODE_SCALE_LERP = 0.18;

const DRAG_SENSITIVITY = 0.006;
const CLICK_THRESHOLD_PX = 6;
const INERTIA_DAMPING = 0.93;
const AMBIENT_SPEED = 0.05;
const MAX_PITCH = 1.0;
const ENTRANCE_DURATION = 1.2;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

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
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

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
    ctx.save();
    ctx.beginPath();
    // Widened the clip so the logo has more room
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.clip();

    const imgAspect = img.width / img.height;
    // Increased the logo draw scale from 0.7 to 0.85
    let drawWidth = size * 0.85; 
    let drawHeight = size * 0.85; 

    if (imgAspect > 1) {
      drawHeight = drawWidth / imgAspect; 
    } else {
      drawWidth = drawHeight * imgAspect; 
    }

    ctx.drawImage(img, c - drawWidth / 2, c - drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(159, 243, 255, 0.9)";
    ctx.font = `700 ${size * 0.22}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
  texture.colorSpace = THREE.SRGBColorSpace; 
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BASE_NODE_SCALE, BASE_NODE_SCALE, 1);
  sprite.userData.sponsor = sponsor;
  sprite.userData.targetScale = BASE_NODE_SCALE;

  if (sponsor.logoUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { paintNodeFace(ctx, size, sponsor, img); texture.needsUpdate = true; };
    img.onerror = () => {};
    img.src = sponsor.logoUrl;
  }
  return sprite;
}

export default function SponsorOrbCanvas({ sponsors, onSelectSponsor, onHoverFrame, verticalOffset = 0, scrollRotationRef }) {
  const canvasRef = useRef(null);
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 0, 9);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);

    const group = new THREE.Group();
    scene.add(group);
    group.position.y = verticalOffset;

    function makeGlowTexture() {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(120,240,255,0.9)");
      grad.addColorStop(0.4, "rgba(63,227,255,0.35)");
      grad.addColorStop(1, "rgba(63,227,255,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
      
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      return tex;
    }

    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowSprite.scale.set(7.5, 7.5, 1);
    group.add(glowSprite);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), new THREE.MeshBasicMaterial({ color: 0x1c5f73, transparent: true, opacity: 0.5 }));
    group.add(core);

    const wire1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.95, 1)), new THREE.LineBasicMaterial({ color: 0x3fe3ff, transparent: true, opacity: 0.55 }));
    group.add(wire1);

    const wire2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 1)), new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 }));
    group.add(wire2);

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
    const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9bf3ff, size: 0.035, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(points);

    const nodeGroup = new THREE.Group();
    group.add(nodeGroup);
    const nodes = sponsorsRef.current.map((sponsor, i) => {
      const sprite = createSponsorSprite(sponsor);
      sprite.position.copy(fibonacciPoint(i, sponsorsRef.current.length, NODE_RADIUS));
      nodeGroup.add(sprite);
      return sprite;
    });

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const worldPos = new THREE.Vector3();

    function pickAtClient(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(nodes, false);
      return hits.length ? hits[0].object : null;
    }

    function projectToScreen(object) {
      object.getWorldPosition(worldPos);
      worldPos.project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: (worldPos.x * 0.5 + 0.5) * rect.width, y: (-worldPos.y * 0.5 + 0.5) * rect.height };
    }

    let isDragging = false;
    let pointerId = null;
    let lastX = 0, lastY = 0, movedDistance = 0, velocityY = 0, velocityX = 0;
    let lastClientX = null, lastClientY = null;
    let hoveredSponsor = null;

    function updateHover(sponsor) {
      if (hoveredSponsor?.id === sponsor?.id) return;
      hoveredSponsor = sponsor;
      nodes.forEach((n) => n.userData.targetScale = n.userData.sponsor.id === sponsor?.id ? HOVER_NODE_SCALE : BASE_NODE_SCALE);
      if (!sponsor) onHoverFrameRef.current?.(null);
    }

    const handlePointerDown = (event) => {
      isDragging = true; pointerId = event.pointerId; canvas.setPointerCapture(pointerId);
      lastX = event.clientX; lastY = event.clientY; movedDistance = 0; velocityX = 0; velocityY = 0;
      canvas.style.cursor = "grabbing";
    };

    const handlePointerMove = (event) => {
      lastClientX = event.clientX; lastClientY = event.clientY;
      if (isDragging && event.pointerId === pointerId) {
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        lastX = event.clientX; lastY = event.clientY;
        movedDistance += Math.abs(dx) + Math.abs(dy);
        velocityY = dx * DRAG_SENSITIVITY; velocityX = dy * DRAG_SENSITIVITY;
        group.rotation.y += velocityY;
        group.rotation.x = clamp(group.rotation.x + velocityX, -MAX_PITCH, MAX_PITCH);
      }
    };

    const handlePointerUp = (event) => {
      if (!isDragging || event.pointerId !== pointerId) return;
      isDragging = false; canvas.releasePointerCapture(pointerId);
      if (movedDistance < CLICK_THRESHOLD_PX) {
        const hit = pickAtClient(event.clientX, event.clientY);
        if (hit) onSelectRef.current?.(hit.userData.sponsor);
      }
      canvas.style.cursor = hoveredSponsor ? "pointer" : "grab";
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.style.touchAction = "pan-y";
    canvas.style.cursor = "grab";

    const resize = () => {
      w = container.clientWidth; h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId;
    let startTime = performance.now();
    let lastTime = startTime;
    let lastScrollRotation = 0;

    function animate() {
      frameId = requestAnimationFrame(animate);
      
      const now = performance.now();
      const t = (now - startTime) * 0.001; 
      const dt = (now - lastTime) * 0.001; 
      lastTime = now;
      
      const entranceT = easeOutCubic(clamp(t / ENTRANCE_DURATION, 0, 1));

      if (scrollRotationRef) {
        const refVal = scrollRotationRef.current;
        const targetScroll = typeof refVal === 'object' && refVal !== null ? (refVal.current || 0) : (refVal || 0);
        
        if (!isNaN(targetScroll)) {
          group.rotation.y += targetScroll - lastScrollRotation;
          lastScrollRotation = targetScroll;
        }
      }

      if (!isDragging) {
        velocityY *= INERTIA_DAMPING; velocityX *= INERTIA_DAMPING;
        group.rotation.y += velocityY + AMBIENT_SPEED * dt;
        group.rotation.x = clamp(group.rotation.x + velocityX, -MAX_PITCH, MAX_PITCH);

        if (lastClientX !== null) {
          const hit = pickAtClient(lastClientX, lastClientY);
          updateHover(hit?.userData.sponsor ?? null);
          canvas.style.cursor = hit ? "pointer" : "grab";
        }
      }

      points.rotation.y = -t * 0.05;
      wire1.rotation.y = t * 0.04;
      wire2.rotation.x = t * 0.03;
      core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);

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
      cancelAnimationFrame(frameId); resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown); canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp); canvas.removeEventListener("pointercancel", handlePointerUp);
      renderer.dispose();
    };
  }, [verticalOffset]);

  return <canvas ref={canvasRef} className="sponsor-orb-canvas" />;
}