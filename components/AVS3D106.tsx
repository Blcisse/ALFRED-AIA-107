// AVS3D_SphereImage6.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }
const COL = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG = {
  baseRadius: 3.0,
  detail: 56,
  pumpMultiplier: 1.8,
  rotationSpeed: { x: 0.0012, y: 0.0038 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

const VERT = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  varying vec2 vUv;
  varying float vDisp;
  void main(){
    vUv = uv;
    vec3 p = position;
    float n = sin(p.x*2.0 + u_time*0.8) * 0.5 + sin(p.y*1.8 + u_time*0.9)*0.35;
    vDisp = n * u_frequency * 0.7;
    vec3 np = position + normal * vDisp * 0.18;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

// frag draws web lines by sampling uv and using subtle sin patterns
const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  uniform vec3 u_colA; uniform vec3 u_colB; uniform float u_time;
  void main(){
    float t = smoothstep(0.0,1.0,vUv.y);
    vec3 base = mix(u_colA, u_colB, t) * 0.85;
    // web-like lines
    float web = abs(sin(vUv.x*120.0 + u_time*2.5) * cos(vUv.y*90.0 + u_time*1.8));
    float alpha = 0.35 * (0.4 + vDisp*0.8) * smoothstep(0.7,0.9, web);
    // overall translucency for ethereal feel
    float shell = 0.7 * (1.0 - smoothstep(0.2,0.8, abs(vDisp)));
    vec3 col = base * (0.6 + shell*0.4);
    gl_FragColor = vec4(col, clamp(alpha + 0.12, 0.02, 0.78));
  }
`;

export const AVS3D106: React.FC<Props> = ({ trackRef }) => {
  const ref = useRef<HTMLCanvasElement|null>(null);
  const anim = useRef<number|null>(null);
  useEffect(()=> {
    if (!ref.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000,0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
    camera.position.set(0,0,CFG.baseRadius*3.05);

    // translucent shell
    const geo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent:true, side:THREE.DoubleSide, depthWrite:false,
      uniforms:{ u_time:{value:0}, u_frequency:{value:0}, u_colA:{value:COL.A}, u_colB:{value:COL.B} }, blending: THREE.NormalBlending
    });
    const shell = new THREE.Mesh(geo, mat); scene.add(shell);

    // multiple faint wireframe layers to create web density
    for (let i=0;i<4;i++){
      const wf = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: (i%2===0)?0x3c9eeb:0x15c7cb, wireframe:true, transparent:true, opacity:0.06 + i*0.02, depthWrite:false }));
      wf.scale.set(1.01 + i*0.005,1.01 + i*0.005,1.01 + i*0.005);
      scene.add(wf);
    }

    scene.add(new THREE.AmbientLight(0x09101a, 0.9));
    const pl = new THREE.PointLight(0x2d6b9a, 0.45, 120); pl.position.set(9,6,10); scene.add(pl);

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch(e){}

    const resize = () => { if(!ref.current) return; const w = ref.current.clientWidth||300; const h = ref.current.clientHeight||300; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); };
    window.addEventListener("resize", resize); resize();

    const loop = () => {
      const t = performance.now()/1000;
      mat.uniforms.u_time.value = t;
      if (analyser) { analyser.getByteFrequencyData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]; const avg = sum/data.length; mat.uniforms.u_frequency.value = avg/255; }
      const f = mat.uniforms.u_frequency.value;
      const target = 1 + f * CFG.pumpMultiplier;
      shell.scale.lerp(new THREE.Vector3(target,target,target), 0.06);
      shell.rotation.y += CFG.rotationSpeed.y; shell.rotation.x += CFG.rotationSpeed.x;
      renderer.render(scene, camera);
      anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
    return ()=> { window.removeEventListener("resize", resize); if(anim.current) cancelAnimationFrame(anim.current); try{ audioCtx.close(); }catch{} renderer.dispose(); };
  },[trackRef]);
  return <canvas ref={ref} style={{ width:"100%", height:"100%", background:"transparent" }} />;
};
