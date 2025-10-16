import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackReference } from "@livekit/components-react";

interface Props { trackRef: TrackReference; }

// Color ramp


const COL_A = new THREE.Color("#59DEFF");
const COL_B = new THREE.Color("#38b6ff");

const CFG = {
  baseRadius: 3.0,
  detail: 56,
  pumpMultiplier: 2.6,
  rotationSpeed: { x: 0.0018, y: 0.0045 },
  fftSize: 1024,
  devicePixelRatioLimit: 2,
  pointsCount: 1600,
  spikeFactor: 0.25, // reduced: how far spikes push out on top of base radius (was 2.6)
};

// Vertex shader for main lattice (gives pop and displacement)
const VERT = `
precision mediump float;
uniform float u_time;
uniform float u_frequency;
uniform float u_bass;
attribute vec3 instanceOffset;
varying vec2 vUv;
varying float vDisp;
void main(){
  vUv = uv;
  vec3 p = position;
  // add time-based noise & per-vertex reactive displacement
  float n = sin(p.x*6.0 + u_time*1.6) * 0.6 + cos(p.y*5.0 + u_time*1.2)*0.35;
  // bass gives big pops, freq gives fine wiggle
  vDisp = (n * (0.5 + u_frequency*1.4) + u_bass*1.6) ;
  // push vertex along normal
  vec3 np = position + normal * vDisp * 0.18;
  // small instance offset for micro-variation (when used)
  np += instanceOffset * 0.02;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
}
`;

// Fragment shader: bright neon lines with stronger alpha and glow band
const FRAG = `
precision mediump float;
varying vec2 vUv;
varying float vDisp;
uniform vec3 u_colA;
uniform vec3 u_colB;
uniform float u_time;
void main(){
  // create grid-like lines with uv sin patterns
  float lines = abs(sin(vUv.x * 100.0 + u_time*1.4) * sin(vUv.y * 70.0 + u_time*0.9));
  // make sharper neon lines
  float band = smoothstep(0.82, 0.86, lines) + 0.6 * smoothstep(0.60, 0.82, lines);
  // boost color and add a slight saturation curve
  vec3 c = mix(u_colA, u_colB, vUv.y);
  c = pow(c, vec3(0.9));
  // use displacement to add brightness to active areas
  float brightness = 0.9 + vDisp*1.2;
  vec3 col = c * brightness;
  // final alpha full (no semi-transparent lines)
  gl_FragColor = vec4(col, 1.0);
}
`;

export const AVS3D102: React.FC<Props> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.devicePixelRatioLimit));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, CFG.baseRadius * 3.5);

    // Base geometry
    const baseGeo = new THREE.IcosahedronGeometry(CFG.baseRadius, CFG.detail);

    // Main shader lattice (no semi-transparency) for bold neon lines
    const mainMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: false, // fully opaque neon lines remain the same
      side: THREE.DoubleSide,
      uniforms: {
        u_time: { value: 0 },
        u_frequency: { value: 0 },
        u_bass: { value: 0 },
        u_colA: { value: COL_A },
        u_colB: { value: COL_B },
      },
      depthWrite: true,
      blending: THREE.AdditiveBlending,
    });

    const mainMesh = new THREE.Mesh(baseGeo, mainMat);
    mainMesh.renderOrder = 1;
    scene.add(mainMesh);

    // Strong wireframe outlines (solid, neon-ish)
    const wire1 = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color: COL_A, wireframe: true, transparent: false }));
    wire1.scale.set(1.01, 1.01, 1.01);
    wire1.renderOrder = 2;
    scene.add(wire1);
    const wire2 = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color: COL_B, wireframe: true, transparent: false }));
    wire2.scale.set(1.03, 1.03, 1.03);
    wire2.renderOrder = 2;
    scene.add(wire2);

    // NOTE: removed the "liquid" glow shell that caused border artifacts.

    // Reactive "spikes": create a Points system sampling the geometry vertices
    const vertices = baseGeo.attributes.position.array as Float32Array;
    const pts = new Float32Array(CFG.pointsCount * 3);
    const offsets = new Float32Array(CFG.pointsCount * 3);

    // sample vertices randomly
    for (let i = 0; i < CFG.pointsCount; i++) {
      const vid = (Math.floor(Math.random() * (vertices.length / 3)) * 3);
      pts[i * 3 + 0] = vertices[vid + 0];
      pts[i * 3 + 1] = vertices[vid + 1];
      pts[i * 3 + 2] = vertices[vid + 2];
      // tiny random offset per instance
      offsets[i * 3 + 0] = (Math.random() - 0.5) * 0.02;
      offsets[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    pointsGeo.setAttribute('instanceOffset', new THREE.BufferAttribute(offsets, 3));

    // Points shader: less aggressive spike distance and semi-transparent spikes
    const pointsVert = `
      precision mediump float;
      attribute vec3 instanceOffset;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_frequency;
      uniform float u_meshScale;
      uniform float u_baseRadius;
      varying float vAct;
      void main(){
        vec3 p = position;
        // normalized direction from center
        vec3 dir = normalize(p);
        // compute activity from audio: give more weight to bass for strong spikes
        float act = 0.9 * u_frequency + 1.6 * u_bass; // reduced sensitivity
        vAct = act;
        // place points near the surface: spikeFactor reduced so they stay close
        float spike = 1.0 + act * ${CFG.spikeFactor.toFixed(2)};
        vec3 np = dir * (u_baseRadius * u_meshScale * spike);
        np += instanceOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
        // smaller max size
        gl_PointSize = 2.0 + act * 8.0; 
      }
    `;

    const pointsFrag = `
      precision mediump float;
      varying float vAct;
      uniform vec3 u_colA;
      uniform vec3 u_colB;
      uniform float u_spikeAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        // soft circular falloff
        float alpha = (1.0 - smoothstep(0.25, 0.6, d)) * u_spikeAlpha;
        vec3 c = mix(u_colA, u_colB, d*0.6);
        // subtle glow scaled down so spikes are not overpowering
        float glow = 0.6 + vAct * 0.6;
        gl_FragColor = vec4(c * glow, alpha);
      }
    `;

    const pointsMat = new THREE.ShaderMaterial({
      vertexShader: pointsVert,
      fragmentShader: pointsFrag,
      blending: THREE.NormalBlending, // use normal blending for semi-transparency
      depthWrite: false,
      depthTest: true, // allow occlusion by the main mesh
      transparent: true,
      uniforms: { u_time: { value: 0 }, u_bass: { value: 0 }, u_frequency: { value: 0 }, u_colA: { value: COL_A }, u_colB: { value: COL_B }, u_meshScale: { value: 1 }, u_baseRadius: { value: CFG.baseRadius }, u_spikeAlpha: { value: 0.45 } }
    });

    const points = new THREE.Points(pointsGeo, pointsMat);
    points.renderOrder = 5; // draw after main mesh so they visually pop but can be occluded
    scene.add(points);

    // center text using canvas texture -> Sprite
    const makeTextSprite = (text: string) => {
      const size = 512;
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.canvas.width = size; ctx.canvas.height = size;
      // transparent background
      ctx.clearRect(0,0,size,size);
      // outer glow
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // glow
      ctx.shadowColor = 'rgba(0,255,246,0.9)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, size/2, size/2);
      const tex = new THREE.CanvasTexture(ctx.canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.5, 1.5, 1);
      return sprite;
    };

    const centerSprite = makeTextSprite('Alfred AIA');
    scene.add(centerSprite);

    // lights
    const amb = new THREE.AmbientLight(0x101217, 1.0);
    scene.add(amb);
    const pl = new THREE.PointLight(0x00fffc, 0.9, 120);
    pl.position.set(8, 6, 8); scene.add(pl);

    // audio setup
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser(); analyser.fftSize = CFG.fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const ms = trackRef?.publication?.track?.mediaStream ?? null;
    if (ms) try { audioCtx.createMediaStreamSource(ms).connect(analyser); } catch (e) { }

    // resizing
    const resize = () => { if (!canvasRef.current) return; const w = canvasRef.current.clientWidth || 300; const h = canvasRef.current.clientHeight || 300; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    window.addEventListener('resize', resize); resize();

    // temporary arrays for analysing bass/treble
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      const now = performance.now() / 1000;
      mainMat.uniforms.u_time.value = now;
      pointsMat.uniforms.u_time.value = now;

      if (analyser) {
        analyser.getByteFrequencyData(freqData);
        // compute average frequency
        let sum = 0; for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        const avg = sum / freqData.length / 255;
        // bass energy (lower bins)
        let bassSum = 0; let bassCount = 0;
        for (let i = 0; i < Math.floor(freqData.length * 0.12); i++) { bassSum += freqData[i]; bassCount++; }
        const bass = bassCount ? (bassSum / bassCount / 255) : 0;
        // map
        mainMat.uniforms.u_frequency.value = avg;
        mainMat.uniforms.u_bass.value = bass;
        pointsMat.uniforms.u_frequency.value = avg;
        pointsMat.uniforms.u_bass.value = bass;

        // pulse scale for main mesh
        const f = avg;
        const target = 1 + f * CFG.pumpMultiplier;
        mainMesh.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
        wire1.scale.lerp(new THREE.Vector3(1.01 + f * 0.04, 1.01 + f * 0.04, 1.01 + f * 0.04), 0.06);
        wire2.scale.lerp(new THREE.Vector3(1.03 + f * 0.025, 1.03 + f * 0.025, 1.03 + f * 0.025), 0.06);

        // update points mesh scale uniform so spikes pop relative to current main mesh size
        pointsMat.uniforms.u_meshScale.value = mainMesh.scale.x;

        // rotate
        mainMesh.rotation.y += CFG.rotationSpeed.y;
        wire1.rotation.y += CFG.rotationSpeed.y * 1.02;
        wire2.rotation.y += CFG.rotationSpeed.y * 1.05;

        // move points outward more dynamically and ensure they render on top
        points.rotation.y += CFG.rotationSpeed.y * 0.8;
      }

      // animate center sprite to face camera and gently pulse
      centerSprite.lookAt(camera.position);
      const sPulse = 1.0 + Math.sin(now * 1.8) * 0.03;
      centerSprite.scale.set(1.5 * sPulse, 1.5 * sPulse, 1);

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try { audioCtx.close(); } catch (e) { }
      renderer.dispose();
    };
  }, [trackRef]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
};
