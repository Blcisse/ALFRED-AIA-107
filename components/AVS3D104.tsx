// AVS3D104.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }
const COLORS = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG = {
  baseRadius: 3.2,
  detail: 72,
  pumpMultiplier: 3.4,
  rotationSpeed: { x: 0.0026, y: 0.007 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

// vertex: stronger displacement + swirl factor for overlapping patterns
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
    float swirl = sin(p.x*2. + u_time*0.6) * cos(p.y*1.3 + u_time*0.9);
    float noise = sin(p.z*3.2 + u_time) * 0.6 + sin((p.x+p.y)*2.4 + u_time*1.3)*0.35;
    float amp = u_frequency * u_pump;
    vDisp = (noise + swirl*0.6) * amp * (0.9 + 0.35 * sin(u_time*0.7 + uv.y*5.));
    vec3 np = position + normal * vDisp * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

// fragment: bold gradient + layered swirl highlights, clamp to avoid white
const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  uniform float u_time;
  void main(){
    float t = smoothstep(0.0,1.0,vUv.y);
    vec3 base = mix(u_colA, u_colB, t);
    // add swirl highlights using sin + displacement
    float s = 0.15 * sin(u_time*1.4 + vUv.x*12.0) * (1.0 + vDisp*0.9);
    base += vec3(0.06, 0.02, 0.12) * s;
    // lively alpha: partial transparency
    float hole = smoothstep(0.18, 0.55, abs(vDisp));
    float alpha = 0.92 * (1.0 - hole);
    // rim glow tint
    float rim = pow(1.0 - length(vUv - 0.5), 1.6) * 0.8;
    base += vec3(0.05,0.02,0.12) * rim;
    base = clamp(base, 0.0, 0.95);
    gl_FragColor = vec4(base, clamp(alpha, 0.0, 1.0));
  }
`;

// additional overlay to draw many tight waveform lines (shader-generated)
const LINE_VERT = `
  precision mediump float;
  uniform float u_time;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;
const LINE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  void main(){
    float lines = abs(sin(vUv.x*300.0 + u_time*6.0) * cos(vUv.y*220.0 + u_time*4.0));
    float alpha = smoothstep(0.85, 0.95, lines) * 0.55;
    vec3 col = mix(u_colA, u_colB, vUv.y);
    gl_FragColor = vec4(col * (0.6 + lines*0.3), alpha);
  }
`;

export const AVS3D104: React.FC<Props> = ({ trackRef }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const anim = useRef<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const canvas = ref.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, CFG.baseRadius * 3.4);

    const outerGeo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);
    const outerMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { u_time: { value: 0 }, u_frequency: { value: 0 }, u_pump: { value: CFG.pumpMultiplier }, u_colA: { value: COLORS.A }, u_colB: { value: COLORS.B } },
      blending: THREE.NormalBlending
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outer);

    // dense overlay lines mesh
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true,
      uniforms: { u_time: { value: 0 }, u_colA: { value: COLORS.A }, u_colB: { value: COLORS.B }}, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const lineMesh = new THREE.Mesh(outerGeo, lineMat);
    lineMesh.scale.set(1.02, 1.02, 1.02);
    scene.add(lineMesh);

    // strong colored rim light
    scene.add(new THREE.AmbientLight(0x111122, 0.9));
    const pl = new THREE.PointLight(0x5a2cff, 0.8, 150);
    pl.position.set(10, 6, 10); scene.add(pl);

    // audio
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch(e){}

    const resize = () => { if (!ref.current) return; const w = ref.current.clientWidth || 300; const h = ref.current.clientHeight || 300; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); };
    window.addEventListener("resize", resize); resize();

    const loop = () => {
      const t = performance.now()/1000;
      outerMat.uniforms.u_time.value = t;
      lineMat.uniforms.u_time.value = t;
      if (analyser) { analyser.getByteFrequencyData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]; const avg = sum/data.length; outerMat.uniforms.u_frequency.value = avg/255; }
      // pulsate outer + subtle camera nudge for no cut-off
      const f = outerMat.uniforms.u_frequency.value;
      const target = Math.min(1 + f * CFG.pumpMultiplier, 3.4);
      outer.scale.lerp(new THREE.Vector3(target,target,target), 0.12);
      lineMesh.scale.lerp(new THREE.Vector3(target*1.02,target*1.02,target*1.02), 0.08);
      outer.rotation.y += CFG.rotationSpeed.y; outer.rotation.x += CFG.rotationSpeed.x;
      lineMesh.rotation.y += CFG.rotationSpeed.y*1.05;
      renderer.render(scene, camera);
      anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);

    return () => { window.removeEventListener("resize", resize); if (anim.current) cancelAnimationFrame(anim.current); try { audioCtx.close(); } catch{} renderer.dispose(); };
  }, [trackRef]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", background: "transparent" }} />;
};
