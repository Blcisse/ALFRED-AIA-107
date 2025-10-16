// AVS3D_SphereImage5.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }
const C = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG = {
  baseRadius: 3.1,
  detail: 64,
  pumpMultiplier: 2.2,
  rotationSpeed: { x: 0.0016, y: 0.0048 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

const VERT = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  varying vec2 vUv;
  varying float vDisp;
  float noise(vec3 p){ return sin(p.x*2.5 + u_time) * 0.6 + sin((p.y+p.z)*1.8 + u_time*0.9)*0.35; }
  void main(){
    vUv = uv;
    vec3 p = position;
    float amp = u_frequency * 0.8;
    vDisp = noise(p*1.2) * amp * (0.6 + 0.3*sin(u_time*0.7 + uv.y*5.2));
    vec3 np = position + normal * vDisp * 0.45;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  uniform vec3 u_colA; uniform vec3 u_colB; uniform float u_time;
  void main(){
    float t = smoothstep(0.0,1.0,vUv.y);
    vec3 base = mix(u_colA, u_colB, t);
    // gentle inner glow (no white)
    float core = 0.28 * (1.0 - length(vUv - 0.5));
    base += vec3(0.04,0.02,0.08) * core;
    // alpha for semi-transparent shell
    float hole = smoothstep(0.22,0.58, abs(vDisp));
    float alpha = 0.9 * (1.0 - hole);
    base = clamp(base, 0.0, 0.95);
    gl_FragColor = vec4(base, alpha);
  }
`;

export const AVS3D105: React.FC<Props> = ({ trackRef }) => {
  const ref = useRef<HTMLCanvasElement|null>(null);
  const anim = useRef<number|null>(null);
  useEffect(()=> {
    if (!ref.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000,0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62,1,0.1,200);
    camera.position.set(0,0,CFG.baseRadius*3.15);

    // shell + inner core (glowing)
    const shellGeo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);
    const shellMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent:true, side:THREE.DoubleSide, depthWrite:false,
      uniforms: { u_time:{value:0}, u_frequency:{value:0}, u_colA:{value:C.A}, u_colB:{value:C.B} }, blending: THREE.NormalBlending
    });
    const shell = new THREE.Mesh(shellGeo, shellMat); scene.add(shell);

    const coreGeo = new THREE.IcosahedronGeometry(CFG.baseRadius*0.6, Math.max(16, CFG.detail/2));
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x083c6a, transparent:true, opacity:0.42, depthWrite:false });
    const core = new THREE.Mesh(coreGeo, coreMat); scene.add(core);

    scene.add(new THREE.AmbientLight(0x101125, 1.0));
    const pl = new THREE.PointLight(0x0f7f9a, 0.55, 120);
    pl.position.set(9,6,10); scene.add(pl);

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch(e){}

    const resize = () => { if (!ref.current) return; const w = ref.current.clientWidth||300; const h = ref.current.clientHeight||300; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); };
    window.addEventListener("resize", resize); resize();

    const loop = () => {
      const t = performance.now()/1000;
      shellMat.uniforms.u_time.value = t;
      if (analyser) { analyser.getByteFrequencyData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]; const avg = sum/data.length; shellMat.uniforms.u_frequency.value = avg/255; }
      const f = shellMat.uniforms.u_frequency.value;
      const target = 1 + f * CFG.pumpMultiplier;
      shell.scale.lerp(new THREE.Vector3(target,target,target), 0.08);
      core.scale.lerp(new THREE.Vector3(0.6*target,0.6*target,0.6*target), 0.06);
      shell.rotation.y += CFG.rotationSpeed.y; shell.rotation.x += CFG.rotationSpeed.x*0.8;
      renderer.render(scene, camera);
      anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
    return ()=> { window.removeEventListener("resize", resize); if(anim.current) cancelAnimationFrame(anim.current); try{ audioCtx.close(); }catch{} renderer.dispose(); };
  },[trackRef]);
  return <canvas ref={ref} style={{ width:"100%", height:"100%", background:"transparent" }} />;
};
