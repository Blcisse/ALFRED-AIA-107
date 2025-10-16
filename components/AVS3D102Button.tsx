"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";

interface Props {
  sizeRem?: number; // optional size override
  href?: string;    // optional navigation target (defaults to /home)
}

const COL_A = new THREE.Color("#59DEFF");
const COL_B = new THREE.Color("#38b6ff");

const CFG = {
  baseRadius: 3.0,
  detail: 56,
  rotationSpeed: { x: 0.0018, y: 0.0045 },
  devicePixelRatioLimit: 2
};

// vertex (non-audio version — still gently morphs using time)
const VERT_NO_AUDIO = `
precision mediump float;
uniform float u_time;
uniform float u_frequency; // kept for compatibility but will be zero
uniform float u_bass;      // kept for compatibility but will be zero
varying vec2 vUv;
varying float vDisp;
void main(){
  vUv = uv;
  vec3 p = position;
  // organic time-based displacement (small amplitude)
  float n = sin(p.x*6.0 + u_time*1.6) * 0.6 + cos(p.y*5.0 + u_time*1.2)*0.35;
  vDisp = (n * (0.5 + u_frequency*1.4) + u_bass*1.6);
  vec3 np = position + normal * vDisp * 0.18;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
}
`;

// fragment (same visual lines as AVS3D102)
const FRAG = `
precision mediump float;
varying vec2 vUv;
varying float vDisp;
uniform vec3 u_colA;
uniform vec3 u_colB;
uniform float u_time;
void main(){
  float lines = abs(sin(vUv.x * 100.0 + u_time*1.4) * sin(vUv.y * 70.0 + u_time*0.9));
  float band = smoothstep(0.82, 0.86, lines) + 0.6 * smoothstep(0.60, 0.82, lines);
  vec3 c = mix(u_colA, u_colB, vUv.y);
  c = pow(c, vec3(0.9));
  float brightness = 0.9 + vDisp*1.2;
  vec3 col = c * brightness;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function AVS3D102Button({ sizeRem = 12, href = "/home" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);

    // Scene & camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, CFG.baseRadius * 3.0);

    // Geometry + material (non-audio)
    const baseGeo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);

    const mainMat = new THREE.ShaderMaterial({
      vertexShader: VERT_NO_AUDIO,
      fragmentShader: FRAG,
      transparent: false,
      side: THREE.DoubleSide,
      uniforms: {
        u_time: { value: 0 },
        u_frequency: { value: 0 }, // no audio
        u_bass: { value: 0 },
        u_colA: { value: COL_A },
        u_colB: { value: COL_B }
      },
      depthWrite: true,
      blending: THREE.AdditiveBlending
    });

    const mainMesh = new THREE.Mesh(baseGeo, mainMat);
    mainMesh.renderOrder = 1;
    scene.add(mainMesh);

    // Wire outlines to match the AVS3D102 look
    const wire1 = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color: COL_A.getHex(), wireframe: true }));
    wire1.scale.set(1.01, 1.01, 1.01);
    wire1.renderOrder = 2;
    scene.add(wire1);

    const wire2 = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color: COL_B.getHex(), wireframe: true }));
    wire2.scale.set(1.03, 1.03, 1.03);
    wire2.renderOrder = 2;
    scene.add(wire2);

    // Lighting (subtle so shader colors stay dominant)
    const amb = new THREE.AmbientLight(0x101217, 1.0);
    scene.add(amb);
    const pl = new THREE.PointLight(0x00fff6, 0.6, 120);
    pl.position.set(8, 6, 8);
    scene.add(pl);

    // Resize handling
    const resize = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth || canvasRef.current.offsetWidth || 300;
      const h = canvasRef.current.clientHeight || canvasRef.current.offsetHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener("resize", resize);
    resize();

    // Animation loop (pure time-driven; no audio)
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const uTime = now / 1000;
      mainMat.uniforms.u_time.value = uTime;
      mainMat.uniforms.u_frequency.value = 0;
      mainMat.uniforms.u_bass.value = 0;

      // gentle pulsate via shader + rotation
      mainMesh.rotation.y += CFG.rotationSpeed.y;
      mainMesh.rotation.x += CFG.rotationSpeed.x;
      wire1.rotation.y += CFG.rotationSpeed.y * 1.02;
      wire2.rotation.y += CFG.rotationSpeed.y * 1.05;

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
      last = now;
    };
    animRef.current = requestAnimationFrame(loop);

    // cleanup
    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try { renderer.dispose(); } catch {}
    };
  }, []);

  // button click handler
  const onClick = () => {
    // navigate to provided href
    router.push(href);
  };

  // Inline styles: sizeRem rem to match your Button size (12rem by default)
  const rem = `${sizeRem}rem`;
  const buttonStyle: React.CSSProperties = {
    width: rem,
    height: rem,
    borderRadius: "9999px",
    padding: 0,
    border: "none",
    display: "inline-block",
    background: "transparent",
    position: "relative",
    cursor: "pointer",
    overflow: "hidden"
  };

  const canvasStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    background: "transparent",
    pointerEvents: "none" // let the button receive clicks, not the canvas
  };

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "white",
    fontWeight: 700,
    fontSize: "0.9rem",
    pointerEvents: "none",
    textShadow: "0 6px 18px rgba(0,0,0,0.6), 0 0 18px rgba(0,255,246,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.3rem"
  };

  return (
    <button aria-label="Start Assistant" style={buttonStyle} onClick={onClick}>
      <canvas ref={canvasRef} style={canvasStyle} />
      <div style={labelStyle}>Start Assistant</div>
    </button>
  );
}
