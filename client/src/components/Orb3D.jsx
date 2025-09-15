// client/src/components/Orb3D.jsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useMemo, useRef } from "react";

/** Thin “+” in front of the sphere (same vibe as your first version) */
function Cross({
  size = 0.6,
  thickness = 0.14,
  color = "#ffffff",
  emissive = "#ffffff",  
  z = 0.41,
}) {
  return (
    <group>
      {/* vertical bar */}
      <mesh position={[0, 0, z]}>
        <boxGeometry args={[thickness, size, thickness]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.5} />
      </mesh>
      {/* horizontal bar */}
      <mesh position={[0, 0, z]}>
        <boxGeometry args={[size, thickness, thickness]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/** Animated electric arc that orbits the sphere */
function ElectricArc({
  radius = 1.06,
  color = "#7cc4ff",
  speed = 0.55,
  wobble = 0.12,
  opacity = 0.9,
  width = 2,
}) {
  const group = useRef();

  // build a noisy, closed 3D curve
  const points = useMemo(() => {
    const pts = [];
    const segments = 140;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const lat = Math.sin(t * 1.7) * 0.45; // helical lat change
      const r = radius + (Math.sin(t * 8.0) * wobble) / 6;
      const x = Math.cos(t) * r * Math.cos(lat);
      const y = Math.sin(lat) * r;
      const z = Math.sin(t) * r * Math.cos(lat);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [radius, wobble]);

  // slow rotation
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.getElapsedTime() * speed;
  });

  return (
    <group ref={group}>
      <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} />
    </group>
  );
}

function OrbMesh() {
  return (
    <group>
      {/* glossy, glassy sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color="#1a3d98"
          roughness={0.15}
          metalness={0.1}
          transmission={0.6}   // glass feel
          transparent
          thickness={0.6}
          clearcoat={1}
          clearcoatRoughness={0.2}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* subtle inner sparkles (as in your first) */}
      <Sparkles count={60} size={2} speed={0.4} scale={2.4} color="#74a6ff" />

      {/* full medical cross */}
      <Cross />

      {/* ⚡ electric arcs layered on top */}
      <ElectricArc radius={1.06} color="#7cc4ff" speed={0.5} wobble={0.14} opacity={0.9} width={2} />
      <ElectricArc radius={1.10} color="#a3b9ff" speed={-0.35} wobble={0.10} opacity={0.55} width={1.2} />

      {/* lighting to keep the same bloom */}
      <pointLight position={[0, 0, 2.2]} intensity={1.8} color="#6ea6ff" />
      <ambientLight intensity={0.35} />
    </group>
  );
}

export default function Orb3D({ width = 380, height = 380 }) {
  // container styling matches your preferred look (soft ring + vignette)
  const wrap = {
    position: "relative",
    width,
    height,
    borderRadius: "50%",
    overflow: "hidden",
    pointerEvents: "none",
    boxShadow:
      "0 0 0 1px rgba(59,130,246,.25) inset, 0 12px 30px rgba(2,6,23,.65), 0 0 60px rgba(59,130,246,.25)",
    background:
      "radial-gradient(40% 40% at 45% 35%, rgba(255,255,255,.22), rgba(255,255,255,0) 60%), radial-gradient(closest-side, rgba(37,99,235,.25), rgba(2,6,23,0) 70%)",
  };

  return (
    <div style={wrap} aria-hidden>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3] }}>
        <Suspense fallback={<Html center style={{ color: "#9ca3af", fontSize: 12 }}>Loading…</Html>}>
          {/* keep the gentle auto-rotate like the first version */}
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} />
          <OrbMesh />
        </Suspense>
      </Canvas>
    </div>
  );
}