// AVS3D_SphereImage2.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }

const COLORS2 = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG2 = {
  baseRadius: 3.0,
  detail: 56,
  pumpMultiplier: 2.2,
  rotationSpeed: { x: 0.0018, y: 0.0045 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

// Simple vertex for slight morph of wire
const VERT2 = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  varying vec2 vUv;
  varying float vDisp;
  void main(){
    vUv = uv;
    vec3 p = position;
    float n = sin(p.x*4.0 + u_time) * 0.5 + sin(p.y*3.0 + u_time*1.1)*0.3;
    vDisp = n * u_frequency;
    vec3 np = position + normal * vDisp * 0.12;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

// Fragment: draw subtle luminous lines by increasing alpha near edges of UV grid
const FRAG2 = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  uniform float u_time;
  void main(){
    // make thin band lines using sin of uv.x*freq and uv.y
    float lines = abs(sin(vUv.x*80.0 + u_time*1.2) * sin(vUv.y*60.0 + u_time*0.8));
    float alpha = smoothstep(0.65,0.75, lines) * (0.15 + vDisp*0.6);
    vec3 c = mix(u_colA, u_colB, vUv.y);
    gl_FragColor = vec4(c * (0.6 + vDisp*0.4), clamp(alpha,0.0,0.9));
  }
`;

export const AVS3D102B: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const animRef = useRef<number|null>(null);
  useEffect(()=> {
    if (!canvasRef.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CFG2.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
    camera.position.set(0,0,CFG2.baseRadius*3.1);

    // base geometry (fine) + three wire-like layers
    const base = new THREE.IcosahedronGeometry(CFG2.baseRadius, CFG2.detail);

    // shader-driven thin layer (gives lattice/wave lines)
    const matLine = new THREE.ShaderMaterial({
      vertexShader: VERT2, fragmentShader: FRAG2, transparent: true, side: THREE.DoubleSide,
      uniforms: { u_time:{value:0}, u_frequency:{value:0}, u_colA:{value:COLORS2.A}, u_colB:{value:COLORS2.B} , u_time_mod:{value:0} },
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const linesMesh = new THREE.Mesh(base, matLine);
    scene.add(linesMesh);

    // more physical wireframe layers for minimalistic look
    const wf1 = new THREE.Mesh(base, new THREE.MeshBasicMaterial({ color: COLORS2.A, wireframe:true, transparent:true, opacity:0.18, depthWrite:false }));
    wf1.scale.set(1.01,1.01,1.01);
    scene.add(wf1);
    const wf2 = new THREE.Mesh(base, new THREE.MeshBasicMaterial({ color: COLORS2.B, wireframe:true, transparent:true, opacity:0.12, depthWrite:false }));
    wf2.scale.set(1.02,1.02,1.02);
    scene.add(wf2);

    // lights
    scene.add(new THREE.AmbientLight(0x0d1a22, 1.0));
    const p = new THREE.PointLight(0x3c9eeb, 0.45, 120);
    p.position.set(8,6,8); scene.add(p);

    // audio
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG2.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try{ audioCtx.createMediaStreamSource(ms).connect(analyser);}catch(e){}

    const resize = () => { if (!canvasRef.current) return; const w = canvasRef.current.clientWidth||300; const h = canvasRef.current.clientHeight||300; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); };
    window.addEventListener("resize", resize); resize();

    const loop = () => {
      const t = performance.now()/1000;
      matLine.uniforms.u_time.value = t;
      if (analyser) { analyser.getByteFrequencyData(data); let sum=0; for(let i=0;i<data.length;i++){ sum+=data[i]; } const avg = sum/data.length; matLine.uniforms.u_frequency.value = avg/255; }
      // subtle scale/pulse on shader layer
      const f = matLine.uniforms.u_frequency.value;
      const target = 1 + f * CFG2.pumpMultiplier;
      linesMesh.scale.lerp(new THREE.Vector3(target,target,target), 0.06);
      wf1.scale.lerp(new THREE.Vector3(1.01+f*0.02,1.01+f*0.02,1.01+f*0.02), 0.06);
      wf2.scale.lerp(new THREE.Vector3(1.02+f*0.015,1.02+f*0.015,1.02+f*0.015), 0.06);
      linesMesh.rotation.y += CFG2.rotationSpeed.y; wf1.rotation.y += CFG2.rotationSpeed.y*1.02; wf2.rotation.y += CFG2.rotationSpeed.y*1.05;
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => { window.removeEventListener("resize", resize); if(animRef.current) cancelAnimationFrame(animRef.current); try{ audioCtx.close(); }catch{} renderer.dispose(); };
  },[trackRef]);

  return <canvas ref={canvasRef} style={{ width:"100%", height:"100%", background:"transparent" }} />;
};
