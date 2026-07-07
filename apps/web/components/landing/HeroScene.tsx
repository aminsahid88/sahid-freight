"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ── City coordinates (lat, lng) — Horn of Africa focus ─────────── */
const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Addis Ababa",   lat:  9.03,  lng: 38.74 },
  { name: "Dire Dawa",     lat:  9.60,  lng: 41.87 },
  { name: "Djibouti City", lat: 11.59,  lng: 43.15 },
  { name: "Hargeisa",      lat:  9.56,  lng: 44.07 },
  { name: "Berbera",       lat: 10.44,  lng: 45.02 },
  { name: "Mogadishu",     lat:  2.05,  lng: 45.32 },
];

/* Routes (source-city index → destination-city index) — 6 flowing arcs. */
const ROUTES: [number, number][] = [
  [0, 2], // Addis Ababa → Djibouti
  [0, 5], // Addis Ababa → Mogadishu
  [1, 3], // Dire Dawa → Hargeisa
  [2, 4], // Djibouti → Berbera
  [3, 5], // Hargeisa → Mogadishu
  [1, 2], // Dire Dawa → Djibouti
];

const RADIUS = 1;
const TEAL   = "#5BE3C4";
const BLUE   = "#3D7BFF";
const NAVY   = "#0A1F44";

/* Convert lat/lng → point on unit sphere (Y up).  */
function latLngToVec3(lat: number, lng: number, r: number = RADIUS) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z =  (r * Math.sin(phi) * Math.sin(theta));
  const y =  (r * Math.cos(phi));
  return new THREE.Vector3(x, y, z);
}

/* Great-circle arc as a QuadraticBezierCurve3 lifted above the surface. */
function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3, lift = 0.35) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  mid.normalize().multiplyScalar(RADIUS + lift + dist * 0.2);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

/* ── Globe: wireframe sphere w/ soft fill ─────────────────────────── */
function Globe({ compact }: { compact: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.06;
  });

  // Fewer polygons on phones — the wireframe is still readable and the
  // GPU work drops meaningfully.
  const solidSeg = compact ? 32 : 64;
  const wireSeg  = compact ? 22 : 42;
  const wireSlic = compact ? 16 : 30;

  return (
    <group ref={groupRef}>
      {/* Solid dark sphere (slightly smaller so the wireframe reads on top) */}
      <mesh>
        <sphereGeometry args={[RADIUS * 0.995, solidSeg, solidSeg]} />
        <meshBasicMaterial color={NAVY} transparent opacity={0.92} />
      </mesh>

      {/* Wireframe overlay */}
      <mesh>
        <sphereGeometry args={[RADIUS, wireSeg, wireSlic]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.22} />
      </mesh>

      {/* City markers + labels + halos */}
      {CITIES.map((c) => {
        const p = latLngToVec3(c.lat, c.lng, RADIUS * 1.005);
        return <CityMarker key={c.name} position={p} />;
      })}

      {/* Flowing routes */}
      {ROUTES.map(([a, b], i) => {
        const from = latLngToVec3(CITIES[a].lat, CITIES[a].lng, RADIUS * 1.01);
        const to   = latLngToVec3(CITIES[b].lat, CITIES[b].lng, RADIUS * 1.01);
        const curve = buildArcCurve(from, to);
        return <RouteArc key={i} curve={curve} phase={i * 0.15} compact={compact} />;
      })}
    </group>
  );
}

/* ── Marker: glowing teal dot + pulsing halo ──────────────────────── */
function CityMarker({ position }: { position: THREE.Vector3 }) {
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!haloRef.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + 0.35 * Math.sin(t * 2 + position.x * 3);
    haloRef.current.scale.setScalar(s);
    (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 - 0.15 * Math.sin(t * 2 + position.x * 3);
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshBasicMaterial color={TEAL} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color={TEAL} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/* ── Route: full arc as a subtle line + moving "packet" bead ─────── */
function RouteArc({ curve, phase, compact }: { curve: THREE.QuadraticBezierCurve3; phase: number; compact: boolean }) {
  const points = useMemo(() => curve.getPoints(compact ? 32 : 64), [curve, compact]);
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const packetRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!packetRef.current) return;
    const t = ((state.clock.elapsedTime * 0.16 + phase) % 1);
    const pt = curve.getPoint(t);
    packetRef.current.position.copy(pt);
    // Fade the packet in/out near the endpoints
    const fade = Math.sin(t * Math.PI); // 0 at ends, 1 at middle
    (packetRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * fade;
    packetRef.current.scale.setScalar(0.7 + 0.6 * fade);
  });

  return (
    <group>
      <primitive object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.35 }))} />
      <mesh ref={packetRef}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshBasicMaterial color={BLUE} />
      </mesh>
    </group>
  );
}

/* ── Atmospheric glow: back-facing shader sphere ──────────────────── */
function Atmosphere() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(BLUE) },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 glowColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(glowColor, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh scale={1.28}>
      <sphereGeometry args={[RADIUS, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ── Camera parallax with mouse-move (bounded, subtle) ───────────── */
function CameraRig({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const p = pointer.current;
    if (!p) return;
    // Ease toward the parallax target
    target.current.x += (p.x * 0.4 - target.current.x) * 0.05;
    target.current.y += (p.y * 0.3 - target.current.y) * 0.05;
    camera.position.x = target.current.x;
    camera.position.y = 0.15 + target.current.y;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ── Public scene component ───────────────────────────────────────── */
export default function HeroScene() {
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef    = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [compact, setCompact] = useState(false);

  // Pause frameloop when the hero scrolls offscreen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Detect small / touch viewports and go compact:
  //   – fewer geometry segments, fewer stars, smaller camera FOV
  //   – no mousemove parallax (touch devices don't have hover).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 640px), (hover: none) and (pointer: coarse)");
    const update = () => setCompact(mql.matches);
    update();
    if (mql.addEventListener) mql.addEventListener("change", update);
    else mql.addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update);
      else mql.removeListener(update);
    };
  }, []);

  // Track mouse for parallax (normalized -1..1). Skipped on touch.
  useEffect(() => {
    if (compact) return;
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      pointerRef.current = {
        x: (e.clientX / w) * 2 - 1,
        y: -((e.clientY / h) * 2 - 1),
      };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [compact]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0.2, 3.1], fov: compact ? 48 : 42 }}
        dpr={compact ? [1, 1.5] : [1, 2]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: !compact, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 2, 4]} intensity={0.6} />
        <Stars radius={40} depth={20} count={compact ? 400 : 1200} factor={2.6} saturation={0} fade speed={0.4} />
        <Atmosphere />
        <Globe compact={compact} />
        <CameraRig pointer={pointerRef} />
      </Canvas>
    </div>
  );
}
