// AVS3DVisualizer.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

/**
 * AVS3DVisualizer
 * - Multi-layered audio-reactive morphing sphere
 * - Inputs: trackRef (LiveKit TrackReference) that contains a mediaStream for audio
 *
 * Key configurable constants below.
 */

interface Props {
  trackRef: TrackReference;
}

const CONFIG = {
  baseRadius: 3.0,            // base sphere size
  geometryDetail: 64,         // subdivisions
  pumpMultiplier: 3.0,        // how much the sphere "pumps" - increase to 2 or 3 per your request
  rotationSpeed: { x: 0.0025, y: 0.006 }, // slow spin speeds
  fftSize: 512,               // analyser FFT size (higher = more freq bins)
  wireframeOpacity: 0.18,
  glowStrength: 0.45,
  devicePixelRatioLimit: 2
};

/* -------------------------
   Shaders
   - vertex displaces along normal using sin/noise and u_frequency
   - fragment paints gradient and uses displacement to create holes/transparency
   ------------------------- */

// Vertex shader (noise via sin combos for stable, lightweight distortion)
const vertexShader = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency; // 0..~1
  uniform float u_pump;      // global pump multiplier
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vNormal;
  varying vec3 vPos;

  // simple layered sin-noise for organic look
  float layeredNoise(vec3 p){
    float n = 0.0;
    n += sin(p.x*3.0 + u_time) * 0.6;
    n += sin((p.y + p.z)*2.2 + u_time*1.3) * 0.35;
    n += sin((p.x*0.5 + p.y*0.7) * 1.8 + u_time*0.8) * 0.2;
    return n;
  }

  void main(){
    vUv = uv;
    vNormal = normal;
    vPos = position;
    // frequency-driven amplitude
    float amp = u_frequency * u_pump;
    float n = layeredNoise(position * 1.5);
    // Use uv and normal to vary displacement more organically
    float disp = n * amp * (0.8 + 0.4 * sin(u_time*0.8 + uv.y*6.3));
    vDisp = disp;
    vec3 newPos = position + normal * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

// Fragment shader (multi-stop gradient + alpha holes based on displacement)
const fragmentShader = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vNormal;
  varying vec3 vPos;

  uniform vec3 u_colorA; // deep purple
  uniform vec3 u_colorB; // blue
  uniform vec3 u_colorC; // cayenne greenish-blue
  uniform float u_time;

  // tiny fresnel for rim glow
  float fresnel(vec3 normal, vec3 viewDir){
    return pow(1.0 - dot(normalize(normal), normalize(viewDir)), 2.0);
  }

  void main(){
    // gradient by vertical UV then modulated by displacement
    float t = smoothstep(0.0, 1.0, vUv.y);
    vec3 base = mix(u_colorA, u_colorB, t);
    base = mix(base, u_colorC, vDisp * 0.5 + 0.5);

    // alpha holes: make parts with big displacement more transparent (create gaps)
    float hole = smoothstep(0.25, 0.6, abs(vDisp));
    float alpha = 1.0 - hole;

    // subtle rim/glow
    vec3 viewDir = normalize(-vPos);
    float r = fresnel(vNormal, viewDir);
    vec3 rim = vec3(1.0, 0.9, 1.0) * (r * 0.25);

    // micro noise highlight for fluid look (light pulse)
    float pulse = 0.15 * sin(u_time * 1.5 + vUv.x * 10.0);
    vec3 color = base + rim * 0.8 + pulse;

    // final alpha falloff towards edges for softness
    float edge = smoothstep(0.0, 0.9, length(vUv - 0.5) * 1.6);
    alpha *= 1.0 - edge * 0.6;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

/* Helper to create shader material with color uniforms */
function createMainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 },
      u_frequency: { value: 0 },
      u_pump: { value: CONFIG.pumpMultiplier },
      u_colorA: { value: new THREE.Color(0x5a00d6) }, // deep purple
      u_colorB: { value: new THREE.Color(0x0066ff) }, // blue
      u_colorC: { value: new THREE.Color(0x00ffbf) }  // greenish-blue (cayenne-ish)
    }
  });
}

/* Slightly altered fragment for glow layer (more blur-like by lower alpha and stronger add) */
const glowFragment = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vNormal;
  varying vec3 vPos;

  uniform vec3 u_colorA;
  uniform vec3 u_colorB;
  uniform vec3 u_colorC;
  uniform float u_time;
  uniform float u_strength;

  void main(){
    float t = smoothstep(0.0,1.0,vUv.y);
    vec3 col = mix(u_colorA, u_colorB, t);
    col = mix(col, u_colorC, vDisp*0.5 + 0.5);
    // emphasize high displacement glow
    float g = smoothstep(0.1, 0.6, abs(vDisp)) * u_strength;
    float alpha = g * 0.8;
    gl_FragColor = vec4(col * (0.6 + g), alpha);
  }
`;

/* Vertex for glow reuses main vertex shader, but simplified instantiation */
const glowVertex = vertexShader;

function createGlowMaterial(strength = CONFIG.glowStrength) {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      u_time: { value: 0 },
      u_frequency: { value: 0 },
      u_pump: { value: CONFIG.pumpMultiplier },
      u_colorA: { value: new THREE.Color(0x5a00d6) },
      u_colorB: { value: new THREE.Color(0x0066ff) },
      u_colorC: { value: new THREE.Color(0x00ffbf) },
      u_strength: { value: strength }
    }
  });
}

/* -------------------------
   Component
   ------------------------- */
export const AVS3D100: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const glowRef = useRef<THREE.Mesh | null>(null);
  const wireRef = useRef<THREE.Mesh | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.devicePixelRatioLimit);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // scene & camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, CONFIG.baseRadius * 6.4); // placed out to fit bigger sphere
    cameraRef.current = camera;

    // geometry and layers
    const geo = new THREE.IcosahedronGeometry(CONFIG.baseRadius, CONFIG.geometryDetail);

    const mainMat = createMainMaterial();
    const mainMesh = new THREE.Mesh(geo, mainMat);
    mainMesh.scale.set(1, 1, 1);
    scene.add(mainMesh);
    meshRef.current = mainMesh;

    // Glow layer: slightly bigger, additive, low alpha
    const glowMat = createGlowMaterial(CONFIG.glowStrength);
    const glowMesh = new THREE.Mesh(geo, glowMat);
    glowMesh.scale.set(1.05, 1.05, 1.05);
    scene.add(glowMesh);
    glowRef.current = glowMesh;

    // Wireframe / lattice overlay (minimalistic)
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x8adfff),
      wireframe: true,
      transparent: true,
      opacity: CONFIG.wireframeOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const wireMesh = new THREE.Mesh(geo, wireMat);
    wireMesh.scale.set(1.01, 1.01, 1.01);
    scene.add(wireMesh);
    wireRef.current = wireMesh;

    // Soft ambient & point fill to help shading and rim
    const amb = new THREE.AmbientLight(0x111122, 1.0);
    scene.add(amb);
    const p = new THREE.PointLight(0xc6a6ff, 0.6, 50);
    p.position.set(10, 6, 8);
    scene.add(p);

    // Audio analyser
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = CONFIG.fftSize;
    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;

    // Connect LiveKit media stream (if available)
    const msTrack = trackRef?.publication?.track?.mediaStream ?? null;
    if (msTrack) {
      try {
        const src = audioCtx.createMediaStreamSource(msTrack);
        src.connect(analyser);
      } catch (e) {
        console.warn("AVS3D100: Unable to create MediaStreamSource", e);
      }
    } else {
      // Fallback: connect analyser to microphone if user wants local test (optional)
      // (left commented intentionally)
      // navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
      //   const src = audioCtx.createMediaStreamSource(s);
      //   src.connect(analyser);
      // }).catch(() => {});
    }

    // Resize helper
    const resize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = canvasRef.current.clientWidth || canvasRef.current.offsetWidth || 300;
      const height = canvasRef.current.clientHeight || canvasRef.current.offsetHeight || 300;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height, false);
    };
    window.addEventListener("resize", resize);
    resize();

    // Animation loop
    let last = performance.now();
    const animate = (t: number) => {
      // frame
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;

      // audio analysis
      let freqNorm = 0.0;
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        // compute a weighted average emphasizing lower mids for punch
        let sum = 0;
        let wsum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const val = dataArrayRef.current[i];
          const weight = 1.0 - Math.pow(i / dataArrayRef.current.length, 1.6); // more weight early bins
          sum += val * weight;
          wsum += weight;
        }
        const avg = wsum ? sum / wsum : 0;
        freqNorm = avg / 255.0;
      }

      // update uniforms/time
      const uTime = now / 1000;
      (mainMat.uniforms.u_time as any).value = uTime;
      (mainMat.uniforms.u_frequency as any).value = freqNorm;
      (glowMat.uniforms.u_time as any).value = uTime;
      (glowMat.uniforms.u_frequency as any).value = freqNorm;

      // pump / scale -> make it bigger: strong pumpMultiplier (CONFIG.pumpMultiplier controls)
      const baseScale = 1.0;
      const pumped = baseScale + freqNorm * CONFIG.pumpMultiplier;
      if (meshRef.current) meshRef.current.scale.lerp(new THREE.Vector3(pumped, pumped, pumped), 0.12);
      if (glowRef.current) glowRef.current.scale.lerp(new THREE.Vector3(pumped * 1.05, pumped * 1.05, pumped * 1.05), 0.08);
      if (wireRef.current) wireRef.current.scale.lerp(new THREE.Vector3(pumped * 1.02, pumped * 1.02, pumped * 1.02), 0.06);

      // rotation (slow spin)
      if (meshRef.current) {
        meshRef.current.rotation.y += CONFIG.rotationSpeed.y;
        meshRef.current.rotation.x += CONFIG.rotationSpeed.x;
      }
      if (glowRef.current) {
        glowRef.current.rotation.y += CONFIG.rotationSpeed.y * 0.9;
        glowRef.current.rotation.x += CONFIG.rotationSpeed.x * 0.9;
      }
      if (wireRef.current) {
        wireRef.current.rotation.y += CONFIG.rotationSpeed.y * 1.02;
      }

      // wire opacity modulation by freq (lines become more or less visible)
      if (wireRef.current && (wireRef.current.material as THREE.Material).opacity !== undefined) {
        const mat = wireRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, CONFIG.wireframeOpacity + freqNorm * 0.28, 0.06);
      }

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    // cleanup
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      try {
        // stop audio context
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
        }
      } catch (_) {}
      // dispose objects
      [mainMesh.geometry, mainMat, glowMat, wireMatSafe(wireRef.current)].forEach((obj) => {
        try {
          // geometry
          if (obj && (obj as any).dispose) (obj as any).dispose();
        } catch {}
      });
      renderer.dispose();
    };
  }, [trackRef]);

  // small safe getter for wire material to dispose properties
  function wireMatSafe(wire?: THREE.Mesh | null) {
    if (!wire) return null;
    const m = wire.material as THREE.Material;
    return m;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: "transparent",
        touchAction: "none"
      }}
    />
  );
};

export default AVS3D100;

