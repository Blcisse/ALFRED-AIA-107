// AVS3D_SphereImage3.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }

const COLORS3 = { A: new THREE.Color("#3C9EEB"), B: new THREE.Color("#15C7CB") };

const CFG3 = {
  baseRadius: 3.0,
  detail: 64,
  pumpMultiplier: 3.2,
  rotationSpeed: { x: 0.0022, y: 0.0052 },
  fftSize: 512,
  devicePixelRatioLimit: 2
};

// Vertex similar to others; fragment creates larger holes and shows inner core
const VERT3 = `
  precision mediump float;
  uniform float u_time;
  uniform float u_frequency;
  uniform float u_pump;
  varying vec2 vUv;
  varying float vDisp;
  void main(){
    vUv = uv;
    vec3 p = position;
    float n = sin(p.x*2.6 + u_time) * 0.6 + sin((p.y+p.z)*1.9 + u_time*1.05)*0.35;
    vDisp = n * u_frequency * 0.8;
    vec3 np = position + normal * vDisp * 0.25;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;

// Fragment with bigger alpha holes and rim glow (no white)
const FRAG3 = `
  precision mediump float;
  varying vec2 vUv; varying float vDisp;
  uniform vec3 u_colA; uniform vec3 u_colB; uniform float u_time;
  void main(){
    float t = smoothstep(0.0,1.0, vUv.y);
    vec3 base = mix(u_colA, u_colB, t);
    // larger holes (hollow look)
    float hole = smoothstep(0.12, 0.52, abs(vDisp));
    float alpha = (1.0 - hole) * 0.82;
    // ripple lines (subtle)
    float ripple = 0.08 * sin(30.0 * length(vUv-0.5) - u_time*3.0);
    base += ripple * 0.25;
    // rim tint
    vec3 rim = vec3(0.05,0.02,0.12) * (1.0 - length(vUv-0.5)) * 0.9;
    base += rim;
    base = clamp(base, 0.0, 0.95);
    gl_FragColor = vec4(base, clamp(alpha,0.0,1.0));
  }
`;

export const AVS3D103: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const animRef = useRef<number|null>(null);
  useEffect(()=> {
    if (!canvasRef.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, CFG3.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
    camera.position.set(0,0,CFG3.baseRadius*3.3);

    // outer shell
    const geo = new THREE.IcosahedronGeometry(CFG3.baseRadius, CFG3.detail);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT3, fragmentShader: FRAG3, transparent:true, side:THREE.DoubleSide, depthWrite:false,
      uniforms:{ u_time:{value:0}, u_frequency:{value:0}, u_pump:{value:CFG3.pumpMultiplier}, u_colA:{value:COLORS3.A}, u_colB:{value:COLORS3.B} },
      blending: THREE.NormalBlending
    });
    const shell = new THREE.Mesh(geo, mat); scene.add(shell);

    // inner visible core (hollow look)
    const coreGeo = new THREE.IcosahedronGeometry(CFG3.baseRadius*0.7, Math.max(16, CFG3.detail/2));
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0f2740, transparent:true, opacity:0.45, depthWrite:false });
    const core = new THREE.Mesh(coreGeo, coreMat); scene.add(core);

    scene.add(new THREE.AmbientLight(0x0c1016, 0.9));
    const pl = new THREE.PointLight(0x15c7cb, 0.5, 120); pl.position.set(10,6,8); scene.add(pl);

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG3.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch(e){}

    const resize = () => { if(!canvasRef.current) return; const w = canvasRef.current.clientWidth||300; const h = canvasRef.current.clientHeight||300; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); };
    window.addEventListener("resize", resize); resize();

    const loop = () => {
      const t = performance.now()/1000;
      mat.uniforms.u_time.value = t;
      if (analyser) { analyser.getByteFrequencyData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]; const avg = sum/data.length; mat.uniforms.u_frequency.value = avg/255; }
      // pump + clamp to avoid clipping (hollow holes expand)
      const f = mat.uniforms.u_frequency.value;
      const target = Math.min(1 + f * CFG3.pumpMultiplier, 3.2);
      shell.scale.lerp(new THREE.Vector3(target,target,target), 0.1);
      core.scale.lerp(new THREE.Vector3(0.7*target,0.7*target,0.7*target), 0.08);
      shell.rotation.y += CFG3.rotationSpeed.y; core.rotation.y += CFG3.rotationSpeed.y*0.8;
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return ()=> { window.removeEventListener("resize", resize); if(animRef.current) cancelAnimationFrame(animRef.current); try{ audioCtx.close(); }catch{} renderer.dispose(); };
  },[trackRef]);
  return <canvas ref={canvasRef} style={{ width:"100%", height:"100%", background:"transparent" }} />;
};
