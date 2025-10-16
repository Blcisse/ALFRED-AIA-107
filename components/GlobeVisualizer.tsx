import * as React from 'react';
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { TrackReference } from '@livekit/components-react';

interface GlobeVisualizerProps {
  trackRef: TrackReference;
}

export const GlobeVisualizer: React.FC<GlobeVisualizerProps> = ({ trackRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !trackRef) return;

    // Set up Three.js scene
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create globe (sphere)
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Set up audio analysis
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const stream = trackRef.publication.track?.mediaStream;
    if (stream) {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    }

    // Handle resizing
    const resizeRenderer = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resizeRenderer);
    resizeRenderer();

    // Animation loop
    const animate = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const scale = 1 + (average - 128) / 128; // Scale based on amplitude
        globe.scale.set(scale, scale, scale);
        globe.rotation.y += 0.01; // Slow rotation for visual interest
      }
      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeRenderer);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContext.close();
    };
  }, [trackRef]);

  return <canvas ref={canvasRef} className="globe-canvas" />;
};