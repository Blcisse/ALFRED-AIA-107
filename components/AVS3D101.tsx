// AVS3D_SphereImage1.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }

const COLORS = {
  A: new THREE.Color("#3C9EEB"),
  B: new THREE.Color("#15C7CB")
};

const CONFIG = {
  baseRadius: 3,
  detail: 64,
  pumpMultiplier: 2.8,
  rotationSpeed: { x: 0.002, y: 0.005 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

// Vertex: layered sin-noise for organic wave distortions
const VERT = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  uniform float u_pump;
  varying vec2 vUv;
  varying float vDisp;
  void main(){
    vUv = uv;
    vec3 p = position;
    float n = sin(p.x*3.0 + u_time) * 0.6 + sin((p.y+p.z)*2.0 + u_time*1.2)*0.35;
    float amp = u_frequency * u_pump;
    float disp = n * amp * (0.7 + 0.3*sin(u_time*0.9 + uv.y*6.0));
    vDisp = disp;
    vec3 np = position + normal * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np, 1.0);
  }
`;

// Fragment: gradient between your two colors + semi-transparent, purple-leaning rim simulated with tint
const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  uniform float u_time;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  void main(){
    float t = smoothstep(0.0, 1.0, vUv.y);
    vec3 base = mix(u_colA, u_colB, t);
    // color modulation by displacement (liquid look)
    base = mix(base, base * 0.8 + vec3(0.05,0.02,0.12), clamp(vDisp*0.6 + 0.5, 0.0, 1.0));
    // alpha holes for hollow feel
    float hole = smoothstep(0.22, 0.6, abs(vDisp));
    float alpha = 0.88 * (1.0 - hole);
    // soft edge
    float edge = smoothstep(0.0, 0.95, length(vUv - 0.5) * 1.6);
    alpha *= 1.0 - edge * 0.6;
    gl_FragColor = vec4(clamp(base, 0.0, 0.95), alpha);
  }
`;

export const AVS3D101: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const animRef = useRef<number|null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    // renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CONFIG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);
    // scene + camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0,0,CONFIG.baseRadius*3.2);
    // geometry + material
    const geo = new THREE.IcosahedronGeometry(CONFIG.baseRadius, CONFIG.detail);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        u_time: { value: 0 },
        u_frequency: { value: 0 },
        u_pump: { value: CONFIG.pumpMultiplier },
        u_colA: { value: COLORS.A },
        u_colB: { value: COLORS.B }
      },
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // soft point fill
    scene.add(new THREE.AmbientLight(0x111122, 0.9));
    const pl = new THREE.PointLight(0x3c9eeb, 0.6, 60);
    pl.position.set(8,6,8);
    scene.add(pl);

    // audio analyser
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = CONFIG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch(e){}

    // resize helper
    const resize = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth || 300;
      const h = canvasRef.current.clientHeight || 300;
      camera.aspect = w/h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener("resize", resize); resize();

    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const uTime = now/1000;
      mat.uniforms.u_time.value = uTime;
      if (analyser) { analyser.getByteFrequencyData(data);
        // weighted avg
        let sum=0, wsum=0;
        for (let i=0;i<data.length;i++){ const weight = 1 - Math.pow(i/data.length, 1.4); sum += data[i]*weight; wsum+=weight; }
        const avg = wsum? sum/wsum : 0;
        mat.uniforms.u_frequency.value = avg/255;
      }
      // pump scale
      const f = mat.uniforms.u_frequency.value;
      const target = 1 + f * CONFIG.pumpMultiplier;
      mesh.scale.lerp(new THREE.Vector3(target,target,target), 0.12);
      // slow spin
      mesh.rotation.y += CONFIG.rotationSpeed.y;
      mesh.rotation.x += CONFIG.rotationSpeed.x;
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try { audioCtx.close(); } catch(e){}
      renderer.dispose();
    };
  }, [trackRef]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", background: "transparent" }} />;
};
