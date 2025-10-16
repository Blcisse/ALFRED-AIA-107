// AVS3D_FromVideo.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference | null; }

/**
 * AVS3D_FromVideo
 * - Built by analyzing the uploaded video frames; prioritizes video look.
 * - Dark/transparent background, neon greenish-teal accents (from video).
 * - Sliding band gradient, subtle shell morph, inner blobs that pop with audio.
 */

const CONFIG = {
  baseRadius: 3.1,
  detail: 56,
  innerBlobCount: 8,
  pulseMultiplier: 2.6,     // inner blob pump intensity
  shellPumpMultiplier: 0.9,  // small shell reactivity
  rotationSpeed: { x: 0.0016, y: 0.0048 },
  fftSize: 512,
  slideSpeed: 1.1,           // tuned from measured motion
  devicePixelRatioLimit: 2
};

// Colors derived from video analysis
const ACCENT_HEX = "#3BC899";        // detected peak (~RGB 59,200,153)
const ACCENT = new THREE.Color(ACCENT_HEX);
const ACCENT_DARK = ACCENT.clone().multiplyScalar(0.36); // darker base
const BACKDROP = new THREE.Color(0x08181b); // very dark subtle tint

// Shell shaders: small displacement, sliding band gradient, no white highlights
const SHELL_VERTEX = `
  precision mediump float;
  uniform float u_time;
  uniform float u_freq;
  uniform float u_shellPump;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vNormal;

  float layered(vec3 p, float t) {
    return sin(p.x*2.6 + t*0.9)*0.5 + sin((p.y+p.z)*1.8 + t*1.1)*0.32;
  }

  void main() {
    vUv = uv;
    vNormal = normal;
    vec3 p = position;
    float n = layered(p, u_time);
    float amp = u_freq * u_shellPump;
    float disp = n * amp * (0.45 + 0.35 * sin(u_time*0.7 + uv.y*5.2));
    vDisp = disp;
    vec3 np = position + normal * disp * 0.36;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np, 1.0);
  }
`;

const SHELL_FRAGMENT = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vNormal;
  uniform float u_time;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  uniform float u_slideSpeed;

  float fresnel(vec3 n) {
    return pow(1.0 - dot(normalize(n), vec3(0.,0.,1.)), 2.0);
  }

  void main() {
    float t = smoothstep(0.0, 1.0, vUv.y);
    vec3 base = mix(u_colA, u_colB, t);

    // Sliding bands: animated UV offset -> flows across sphere
    float slide = sin((vUv.x * 7.5 + u_time * u_slideSpeed) * (0.9 + vUv.y * 0.5))
                * 0.45 + cos((vUv.y * 5.5 - u_time * (u_slideSpeed*0.6))) * 0.18;
    base *= 0.92 + 0.16 * slide * (0.6 + vDisp * 1.1);

    // colored rim (no white)
    float r = fresnel(vNormal);
    base += vec3(0.04, 0.02, 0.06) * (r * 0.6);

    // alpha holes for hollow feel
    float hole = smoothstep(0.22, 0.56, abs(vDisp));
    float alpha = 0.86 * (1.0 - hole);

    // soft edge falloff
    float edge = smoothstep(0.0, 0.95, length(vUv - 0.5) * 1.6);
    alpha *= 1.0 - edge * 0.55;

    base = clamp(base, 0.0, 0.95);
    gl_FragColor = vec4(base, clamp(alpha, 0.0, 1.0));
  }
`;

/* Component */
export const AVS3D108: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.devicePixelRatioLimit));
    renderer.setClearColor(BACKDROP.getHex(), 0);
    // Scene / Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, CONFIG.baseRadius * 3.15); // small safety pull-back
    scene.add(camera);

    // Shell
    const shellGeo = new THREE.IcosahedronGeometry(CONFIG.baseRadius, CONFIG.detail);
    const shellMat = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        u_time: { value: 0 },
        u_freq: { value: 0 },
        u_shellPump: { value: CONFIG.shellPumpMultiplier },
        u_colA: { value: ACCENT_DARK },
        u_colB: { value: ACCENT },
        u_slideSpeed: { value: CONFIG.slideSpeed }
      }
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    scene.add(shell);

    // Subtle lattice/wire overlay
    const wire = new THREE.Mesh(
      shellGeo,
      new THREE.MeshBasicMaterial({ color: ACCENT.getHex(), wireframe: true, transparent: true, opacity: 0.10, depthWrite: false, blending: THREE.NormalBlending })
    );
    wire.scale.set(1.014, 1.014, 1.014);
    scene.add(wire);

    // Inner blobs (hidden until audio causes them to pop)
    const innerGroup = new THREE.Group();
    const blobGeo = new THREE.IcosahedronGeometry(CONFIG.baseRadius * 0.12, 1);
    for (let i = 0; i < CONFIG.innerBlobCount; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: ACCENT.getHex(),
        emissive: ACCENT.clone().multiplyScalar(0.45),
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.94,
        roughness: 0.4,
        metalness: 0.0
      });
      const mesh = new THREE.Mesh(blobGeo, m);
      const theta = (i / CONFIG.innerBlobCount) * Math.PI * 2;
      const r = CONFIG.baseRadius * (0.2 + 0.18 * ((i % 4) / 4));
      mesh.position.set(Math.cos(theta) * r * 0.6, Math.sin(theta * 1.25) * r * 0.5, Math.sin(theta * 0.7) * r * 0.45);
      mesh.scale.setScalar(0.001 + 0.5 * (0.6 + (i % 3) * 0.08));
      innerGroup.add(mesh);
    }
    scene.add(innerGroup);

    // Lights
    scene.add(new THREE.AmbientLight(0x091111, 1.0));
    const p = new THREE.PointLight(ACCENT.getHex(), 0.6, 80);
    p.position.set(8, 5, 8);
    scene.add(p);

    // Audio
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = CONFIG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    if (trackRef?.publication?.track?.mediaStream) {
      try {
        const src = audioCtx.createMediaStreamSource(trackRef.publication.track.mediaStream);
        src.connect(analyser);
      } catch (e) {
        console.warn("AVS3D_FromVideo: audio connect failed", e);
      }
    }

    // Resize helper
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

    // Animation loop
    let last = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      // audio analysis -> weighted average emphasizing lower-mid
      let freq = 0;
      if (analyser) {
        analyser.getByteFrequencyData(data);
        let s = 0, w = 0;
        for (let i = 0; i < data.length; i++) {
          const val = data[i];
          const weight = 1.0 - Math.pow(i / data.length, 1.6);
          s += val * weight;
          w += weight;
        }
        const avg = w ? s / w : 0;
        freq = avg / 255.0;
      }

      const ut = now / 1000;
      shellMat.uniforms.u_time.value = ut;
      shellMat.uniforms.u_freq.value = freq;

      // shell reacts slightly (keeps expansion internal)
      const shellTarget = 1 + freq * CONFIG.shellPumpMultiplier * 0.12;
      shell.scale.lerp(new THREE.Vector3(shellTarget, shellTarget, shellTarget), 0.08);
      wire.scale.lerp(new THREE.Vector3(shellTarget * 1.015, shellTarget * 1.015, shellTarget * 1.015), 0.06);

      // inner blobs pop/pulse more visibly
      const popTarget = 0.65 + freq * CONFIG.pulseMultiplier;
      innerGroup.children.forEach((c, i) => {
        const mesh = c as THREE.Mesh;
        const phase = 0.6 + 0.4 * Math.sin(ut * 1.1 + i);
        const desired = Math.max(0.14, popTarget * phase);
        mesh.scale.lerp(new THREE.Vector3(desired, desired, desired), 0.18);
        // emissive intensity mod
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + freq * 1.2;
      });

      // rotations
      shell.rotation.y += CONFIG.rotationSpeed.y;
      shell.rotation.x += CONFIG.rotationSpeed.x * 0.6;
      innerGroup.rotation.y += CONFIG.rotationSpeed.y * 0.9;
      wire.rotation.y += CONFIG.rotationSpeed.y * 1.02;

      // gentle camera nudge to avoid clipping but keep close appearance
      const baseZ = CONFIG.baseRadius * 3.15;
      const extra = Math.min((shellTarget - 1) * 0.34, 0.9);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ + extra, 0.06);

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    // cleanup
    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try { if (audioCtx && audioCtx.state !== "closed") audioCtx.close(); } catch {}
      renderer.dispose();
    };
  }, [trackRef]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", background: "transparent" }} />;
};

export default AVS3D108;
