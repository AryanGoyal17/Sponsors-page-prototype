// SponsorOrbCanvas.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./SponsorOrbCanvas.css";

const NODE_RADIUS = 2.6;
const BASE_NODE_SCALE = 0.55;
const HOVER_NODE_SCALE = 0.85; 
const NODE_SCALE_LERP = 0.18;
const ENTRANCE_DURATION = 1.2;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function equatorialPoint(i, count, radius) {
  const theta = (i / count) * Math.PI * 2;
  return new THREE.Vector3(
    radius * Math.sin(theta), 
    0,                        
    radius * Math.cos(theta)  
  );
}

function paintNodeFace(ctx, size, sponsor, img) {
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(15, 30, 40, 0.95)");
  grad.addColorStop(0.72, "rgba(20, 50, 65, 0.9)");
  grad.addColorStop(1, "rgba(63, 227, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "rgba(159, 243, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c, c, c - 4, 0, Math.PI * 2); ctx.stroke();

  if (img) {
    const logoSize = size * 0.6; 
    ctx.drawImage(img, c - logoSize / 2, c - logoSize / 2, logoSize, logoSize);
  } else {
    ctx.fillStyle = "rgba(159, 243, 255, 0.9)";
    ctx.font = `700 ${size * 0.22}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = (sponsor.name || "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
    ctx.fillText(initials, c, c + 2);
  }
}

function createSponsorSprite(sponsor) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  paintNodeFace(ctx, size, sponsor, null);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
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
    img.src = sponsor.logoUrl;
  }
  return sprite;
}

export default function SponsorOrbCanvas({ sponsors, onHoverFrame, scrollRotationRef }) {
  const canvasRef = useRef(null);
  const onHoverFrameRef = useRef(onHoverFrame);
  onHoverFrameRef.current = onHoverFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement ?? canvas;
    let w = container.clientWidth || 1;
    let h = container.clientHeight || 1;
    
    // Dynamic scale modifier: shrinks the orb by 35% on mobile devices
    let mobileScaleModifier = w < 768 ? 0.65 : 1; 

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);

    const group = new THREE.Group();
    scene.add(group);

    // --- Aesthetics (Glow, Core, Shells, Particles) ---
    function makeGlowTexture() {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(120,240,255,0.9)");
      grad.addColorStop(0.4, "rgba(63,227,255,0.35)");
      grad.addColorStop(1, "rgba(63,227,255,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    }

    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glowSprite.scale.set(7.5, 7.5, 1);
    group.add(glowSprite);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), new THREE.MeshBasicMaterial({ color: 0x1c5f73, transparent: true, opacity: 0.5 }));
    group.add(core);

    const wire1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.95, 1)), new THREE.LineBasicMaterial({ color: 0x3fe3ff, transparent: true, opacity: 0.55 }));
    group.add(wire1);

    const wire2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 1)), new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 }));
    group.add(wire2);

    const positions = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
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

    // --- Sponsor Nodes ---
    const nodeGroup = new THREE.Group();
    group.add(nodeGroup);
    
    const nodes = sponsors.map((sponsor, i) => {
      const sprite = createSponsorSprite(sponsor);
      sprite.position.copy(equatorialPoint(i, sponsors.length, NODE_RADIUS));
      nodeGroup.add(sprite);
      return sprite;
    });

    const worldPos = new THREE.Vector3();
    function projectToScreen(object) {
      object.getWorldPosition(worldPos);
      worldPos.project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: (worldPos.x * 0.5 + 0.5) * rect.width, y: (-worldPos.y * 0.5 + 0.5) * rect.height };
    }

    const resize = () => {
      w = container.clientWidth; h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; 
      camera.updateProjectionMatrix(); 
      renderer.setSize(w, h);
      
      // Update mobile scale modifier on resize
      mobileScaleModifier = w < 768 ? 0.65 : 1;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const entranceT = easeOutCubic(clamp(t / ENTRANCE_DURATION, 0, 1));

      // 1. Strict Scroll Rotation
      if (scrollRotationRef) {
        nodeGroup.rotation.y = scrollRotationRef.current.current;
      }

      // 2. Ambient background rotations
      points.rotation.y = -t * 0.05;
      wire1.rotation.y = t * 0.04;
      wire2.rotation.x = t * 0.03;
      core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);

      // 3. Auto-Focus Logic (Find closest node)
      let maxZ = -Infinity;
      let frontNode = null;

      nodes.forEach((n) => {
        n.getWorldPosition(worldPos);
        if (worldPos.z > maxZ) {
          maxZ = worldPos.z;
          frontNode = n;
        }
        n.userData.targetScale = BASE_NODE_SCALE;
      });

      // Show tooltip automatically for front node (makes mobile tap easy)
      if (frontNode) {
        frontNode.userData.targetScale = HOVER_NODE_SCALE;
        const screen = projectToScreen(frontNode);
        onHoverFrameRef.current?.({ sponsor: frontNode.userData.sponsor, ...screen });
      }

      // Smooth node scaling
      nodes.forEach((n) => {
        n.scale.x += (n.userData.targetScale - n.scale.x) * NODE_SCALE_LERP;
        n.scale.y = n.scale.x;
      });

      // Apply Base Scale + Mobile Size modifier
      group.scale.setScalar(mobileScaleModifier * (0.6 + 0.4 * entranceT));
      
      // Entrance Animations
      wire1.material.opacity = 0.55 * entranceT;
      wire2.material.opacity = 0.25 * entranceT;
      points.material.opacity = 0.85 * entranceT;
      core.material.opacity = 0.5 * entranceT;
      glowSprite.material.opacity = entranceT;
      glowSprite.scale.setScalar(7.5 + Math.sin(t * 1.2) * 0.4);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="sponsor-orb-canvas" />;
}