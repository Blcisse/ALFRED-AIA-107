import * as React from 'react';
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { TrackReference } from '@livekit/components-react';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

interface EarthVisualizerProps {
  trackRef: TrackReference;
}


export const EarthVisualizer: React.FC<EarthVisualizerProps> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !trackRef) return;

    // Three.js setup
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true });
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 3.5;
    cameraRef.current = camera;

    // Load Earth texture (place in public/)
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/earth.jpg');

    // Earth mesh with custom shader for morphing
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        earthTexture: { value: earthTexture },
        uTime: { value: 0 },
        uWaterElevation: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaterElevation;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 displacedPosition = position + normal * uWaterElevation;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D earthTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(earthTexture, vUv);
        }
      `,
    });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // Audio setup
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    dataArrayRef.current = dataArray;

    const stream = trackRef.publication.track?.mediaStream;
    if (stream) {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    }

    // Postprocessing for bloom effect
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvasRef.current.clientWidth, canvasRef.current.clientHeight), 1.5, 0.4, 0.85);
    composer.addPass(bloomPass);

    // Resize handler
    const resizeRenderer = () => {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      composer.setSize(width, height);
    };
    window.addEventListener('resize', resizeRenderer);
    resizeRenderer();

    // Animation loop
    let elapsedTime = 0;
    const tick = () => {
      elapsedTime += 0.016; // Approx 60 FPS
      material.uniforms.uTime.value = elapsedTime;

      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const subVal = dataArrayRef.current[2];
        material.uniforms.uWaterElevation.value = (Math.pow(subVal / 100, 10) / 10000) * 0.05; // Adjust scale as needed
        earth.rotation.y -= (Math.pow(dataArrayRef.current[70] / 100, 5) / 500) * 0.1; // Mid-high frequency rotation
      }

      camera.position.x = Math.cos(elapsedTime / 10) * 3.5;
      camera.position.z = Math.sin(elapsedTime / 10) * 3.5;
      camera.lookAt(earth.position);

      composer.render();
      requestAnimationFrame(tick);
    };
    tick();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeRenderer);
      renderer.dispose();
      // scene.dispose(); // Removed because Scene has no dispose method
      composer.dispose();
    };

    
  }, [trackRef]);

  return <canvas ref={canvasRef} className="earth-canvas" />;
};