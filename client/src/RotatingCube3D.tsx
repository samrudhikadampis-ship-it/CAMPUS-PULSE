import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export function RotatingCube3D({ size = 260 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 4.3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Group for the cube
    const group = new THREE.Group();
    scene.add(group);

    // Initial isometric angle matching the screenshot
    group.rotation.x = 0.35;
    group.rotation.y = 0.55;

    // Glowing rounded cube box
    const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    
    // Wireframe edges with vivid neon orange
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff8c00,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    group.add(wireframe);

    // Semi-transparent glowing glass body
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff6600,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true,
      opacity: 0.4,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    const cubeMesh = new THREE.Mesh(geometry, cubeMat);
    group.add(cubeMesh);

    // Add glowing committee labels on each face using canvas textures matching uploaded image
    const faces = ["MUDRA", "IEEE CS", "CSI", "FACE", "OCULUS", "ROTARACT"];
    const facePositions: [number, number, number, number, number][] = [
      [0, 0, 0.91, 0, 0],             // Front
      [0, 0, -0.91, 0, Math.PI],       // Back
      [0.91, 0, 0, 0, Math.PI / 2],    // Right
      [-0.91, 0, 0, 0, -Math.PI / 2],  // Left
      [0, 0.91, 0, -Math.PI / 2, 0],   // Top
      [0, -0.91, 0, Math.PI / 2, 0]    // Bottom
    ];

    facePositions.forEach((pos, idx) => {
      const textCanvas = document.createElement("canvas");
      textCanvas.width = 512;
      textCanvas.height = 512;
      const ctx = textCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 512, 512);
        ctx.fillStyle = "#ffaa44";
        ctx.shadowColor = "#ff6a00";
        ctx.shadowBlur = 28;
        ctx.font = "900 68px 'Space Grotesk', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(faces[idx], 256, 256);
      }
      const texture = new THREE.CanvasTexture(textCanvas);
      const textGeo = new THREE.PlaneGeometry(1.6, 1.6);
      const textMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      textMesh.position.set(pos[0], pos[1], pos[2]);
      textMesh.rotation.x = pos[3];
      textMesh.rotation.y = pos[4];
      group.add(textMesh);
    });

    // Central glowing energy core
    const coreGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffbb33,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Glowing corner vertices
    const cornerOffsets = [-0.9, 0.9];
    const sphereGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    for (const x of cornerOffsets) {
      for (const y of cornerOffsets) {
        for (const z of cornerOffsets) {
          const cornerDot = new THREE.Mesh(sphereGeo, sphereMat);
          cornerDot.position.set(x, y, z);
          group.add(cornerDot);
        }
      }
    }

    // Surrounding floating constellation nodes & lines (matching screenshot)
    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 4.5;
      particlePositions[i + 1] = (Math.random() - 0.5) * 4.5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 4.5;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xff8800,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff7700, 4, 25);
    pointLight.position.set(4, 4, 4);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xff3300, 2.5, 25);
    pointLight2.position.set(-4, -4, -4);
    scene.add(pointLight2);

    // Mouse drag rotation interaction
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      group.rotation.y += deltaX * 0.012;
      group.rotation.x += deltaY * 0.012;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => { isDragging = false; };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Animation Loop
    let reqId: number;
    const animate = () => {
      if (!isDragging && !prefersReducedMotion) {
        // Continuous smooth 3D rotation
        group.rotation.y += 0.015;
        group.rotation.x += 0.008;
        core.rotation.y -= 0.025;
        particles.rotation.y += 0.002;
        particles.rotation.x += 0.001;
      }
      renderer.render(scene, camera);
      reqId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      geometry.dispose();
      edges.dispose();
      cubeMat.dispose();
      lineMaterial.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      container.innerHTML = "";
    };
  }, [size]);

  return (
    <div style={{ textAlign: "center", display: "inline-block" }}>
      <div
        ref={mountRef}
        style={{
          width: size,
          height: size,
          cursor: "grab",
          touchAction: "none",
          filter: "drop-shadow(0 0 35px rgba(255,110,0,0.5))"
        }}
      />
      <small style={{ color: "var(--or2)", fontFamily: "monospace", opacity: 0.9, fontSize: "0.8rem", display: "block", marginTop: -4 }}>
        ↔ Drag to rotate
      </small>
    </div>
  );
}
