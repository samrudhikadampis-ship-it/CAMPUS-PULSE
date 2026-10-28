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
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Group for the cube
    const group = new THREE.Group();
    scene.add(group);

    // Rounded glowing glass cube
    const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    
    // Wireframe edges with vivid neon orange
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff7b00,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    group.add(wireframe);

    // Semi-transparent glowing glass body
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff6200,
      metalness: 0.1,
      roughness: 0.15,
      transmission: 0.85,
      transparent: true,
      opacity: 0.35,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    const cubeMesh = new THREE.Mesh(geometry, cubeMat);
    group.add(cubeMesh);

    // Add glowing committee labels on each face using canvas textures
    const faces = ["CSI", "IEEE CS", "MUDRA", "FACE", "OCULUS", "ROTARACT"];
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
        ctx.fillStyle = "#ff8c00";
        ctx.shadowColor = "#ff5500";
        ctx.shadowBlur = 24;
        ctx.font = "900 64px 'Space Grotesk', system-ui, sans-serif";
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
      color: 0xffaa00,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff7700, 3, 20);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xff3300, 2, 20);
    pointLight2.position.set(-3, -3, -3);
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
      group.rotation.y += deltaX * 0.01;
      group.rotation.x += deltaY * 0.01;
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
        group.rotation.y += 0.008;
        group.rotation.x += 0.004;
        core.rotation.y -= 0.015;
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
          filter: "drop-shadow(0 0 25px rgba(255,106,0,0.35))"
        }}
      />
      <small style={{ color: "var(--or2)", fontFamily: "monospace", opacity: 0.85, fontSize: "0.75rem", display: "block", marginTop: -6 }}>
        ↔ Drag to rotate
      </small>
    </div>
  );
}
