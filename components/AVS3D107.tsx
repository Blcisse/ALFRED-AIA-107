// AVS3D_SphereImage7.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }
const COLS = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG = {
  baseRadius: 3.0,
  detail: 72,
  pumpMultiplier: 3.6,
  rotationSpeed: { x: 0.0028, y: 0.0065 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

const VERT = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  uniform float u_pump;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vPos;
  // chaotic irregular noise mix
  float irr(vec3 p){
    return sin(p.x*3.5 + u_time*0.9)*0.5 + cos(p.y*2.4 + u_time*1.2)*0.4 + sin(p.z*1.8 + u_time*0.7)*0.35;
  }
  void main(){
    vUv = uv; vPos = position;
    float n = irr(position*1.2);
    float amp = u_frequency * u_pump;
    vDisp = n * amp * (0.9 + 0.5 * sin(u_time*0.6 + uv.y*6.5));
    vec3 np = position + normal * vDisp * 0.7;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

// fragment: big dynamic holes, darker interior, purple rim glow, clamp color
const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vDisp;
  varying vec3 vPos;
  uniform vec3 u_colA;
  uniform vec3 u_colB;
  uniform float u_time;
  float fresnel(vec3 n, vec3 v){ return pow(1.0 - dot(normalize(n), normalize(v)), 2.0); }
  void main(){
    float t = smoothstep(0.0,1.0, vUv.y);
    vec3 base = mix(u_colA, u_colB, t);
    // large holes
    float hole = smoothstep(0.08, 0.48, abs(vDisp));
    float alpha = (1.0 - hole) * 0.84;
    // rim glow purple leaning
    vec3 viewDir = normalize(-vPos);
    float r = fresnel(vec3(0.,0.,1.), viewDir);
    base += vec3(0.16,0.04,0.6) * (r * 0.35);
    // chaotic micro-tint
    base += 0.06 * sin(u_time*1.3 + vUv.x*10.0) * vec3(0.08,0.02,0.25);
    base = clamp(base, 0.0, 0.95);
    gl_FragColor = vec4(base, clamp(alpha, 0.0, 1.0));
  }
`;

export const AVS3D107: React.FC<Props> = ({ trackRef }) => {
  const ref = useRef<HTMLCanvasElement|null>(null);
  const anim = useRef<number|null>(null);
  useEffect(()=> {
    if (!ref.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000,0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
    camera.position.set(0,0,CFG.baseRadius*3.4);

    const geo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent:true, side:THREE.DoubleSide, depthWrite:false,
      uniforms:{ u_time:{value:0}, u_frequency:{value:0}, u_pump:{value:CFG.pumpMultiplier}, u_colA:{value:COLS.A}, u_colB:{value:COLS.B} }, blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);

    // accent wireframe for mystical lines
    const wf = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0x3c9eeb, wireframe:true, transparent:true, opacity:0.14, depthWrite:false }));
    wf.scale.set(1.02,1.02,1.02); scene.add(wf);

    scene.add(new THREE.AmbientLight(0x0b0d12, 0.9));
    const pl = new THREE.PointLight(0x4d2dbf, 0.55, 140); pl.position.set(11,7,12); scene.add(pl);

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
      const target = Math.min(1 + f * CFG.pumpMultiplier, 3.6);
      mesh.scale.lerp(new THREE.Vector3(target,target,target), 0.12);
      wf.scale.lerp(new THREE.Vector3(1.02+f*0.03,1.02+f*0.03,1.02+f*0.03), 0.08);
      mesh.rotation.y += CFG.rotationSpeed.y * (1.0 + f*0.02);
      wf.rotation.y += CFG.rotationSpeed.y * 1.05;
      renderer.render(scene, camera);
      anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
    return ()=> { window.removeEventListener("resize", resize); if(anim.current) cancelAnimationFrame(anim.current); try{ audioCtx.close(); }catch{} renderer.dispose(); };
  },[trackRef]);
  return <canvas ref={ref} style={{ width:"100%", height:"100%", background:"transparent" }} />;
};
