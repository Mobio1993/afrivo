import { useEffect, useRef } from "react";
import "./NetworkAnimation.css";

const NODE_COUNT = 25;
const PARTICLE_COUNT = 7;
const CONNECT_DISTANCE = 150;
const TWO_PI = Math.PI * 2;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeNode(width, height, index) {
  const chance = Math.random();
  const isActive = index % 10 === 0 || chance > 0.9;
  const radius = isActive ? 9 : chance > 0.6 ? 6 : 4;

  return {
    x: randomBetween(radius, Math.max(radius, width - radius)),
    y: randomBetween(radius, Math.max(radius, height - radius)),
    vx: randomBetween(-0.35, 0.35) || 0.18,
    vy: randomBetween(-0.35, 0.35) || -0.18,
    radius,
    pulsePhase: randomBetween(0, TWO_PI),
    pulseSpeed: randomBetween(0.02, 0.05),
    isActive,
  };
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function findLinks(nodes) {
  const links = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const distance = distanceBetween(nodes[i], nodes[j]);
      if (distance < CONNECT_DISTANCE) {
        links.push({ from: i, to: j, distance });
      }
    }
  }
  return links;
}

function assignParticle(particle, links) {
  if (!links.length) {
    particle.fromNode = 0;
    particle.toNode = 0;
    particle.progress = 0;
    return;
  }

  const link = links[Math.floor(Math.random() * links.length)];
  particle.fromNode = link.from;
  particle.toNode = link.to;
  particle.progress = 0;
  particle.speed = randomBetween(0.008, 0.015);
  particle.opacity = randomBetween(0.7, 1);
}

export default function NetworkAnimation() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return undefined;

    const ctx = canvas.getContext("2d");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    let animationId = null;
    let width = 1;
    let height = 1;
    let nodes = [];
    let particles = [];
    let links = [];

    function sizeCanvas(nextWidth, nextHeight) {
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(1, Math.floor(nextWidth));
      height = Math.max(1, Math.floor(nextHeight));
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resetScene() {
      nodes = Array.from({ length: NODE_COUNT }, (_, index) => makeNode(width, height, index));
      links = findLinks(nodes);
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        fromNode: 0,
        toNode: 0,
        progress: 0,
        speed: randomBetween(0.008, 0.015),
        opacity: randomBetween(0.7, 1),
      }));
      particles.forEach((particle) => assignParticle(particle, links));
    }

    function drawLinks(currentLinks) {
      currentLinks.forEach((link) => {
        const from = nodes[link.from];
        const to = nodes[link.to];
        const opacity = clamp(1 - link.distance / CONNECT_DISTANCE, 0, 1);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `rgba(93, 202, 165, ${opacity * 0.58})`;
        ctx.lineWidth = 0.5 + opacity * 0.5;
        ctx.stroke();
      });
    }

    function drawParticles(currentLinks) {
      particles.forEach((particle) => {
        particle.progress += particle.speed;
        if (particle.progress >= 1) {
          assignParticle(particle, currentLinks);
        }

        const from = nodes[particle.fromNode];
        const to = nodes[particle.toNode];
        if (!from || !to) return;

        const x = from.x + (to.x - from.x) * particle.progress;
        const y = from.y + (to.y - from.y) * particle.progress;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, TWO_PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    function drawNodes() {
      nodes.forEach((node) => {
        const pulse = node.isActive ? Math.sin(node.pulsePhase) * 3 : 0;
        const displayRadius = node.radius + pulse;

        if (node.isActive) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 2.5 + Math.max(pulse, 0), 0, TWO_PI);
          ctx.fillStyle = "rgba(93, 202, 165, 0.15)";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(2, displayRadius), 0, TWO_PI);
        ctx.fillStyle = node.isActive ? "rgba(93, 202, 165, 1)" : "rgba(15, 110, 86, 0.8)";
        ctx.fill();

        if (node.isActive) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(2, displayRadius + 3), 0, TWO_PI);
          ctx.strokeStyle = "rgba(93, 202, 165, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    function updateNodes() {
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        node.pulsePhase += node.pulseSpeed;

        if (node.x < node.radius || node.x > width - node.radius) {
          node.vx *= -1;
          node.x = clamp(node.x, node.radius, width - node.radius);
        }
        if (node.y < node.radius || node.y > height - node.radius) {
          node.vy *= -1;
          node.y = clamp(node.y, node.radius, height - node.radius);
        }
      });
    }

    function drawFrame({ staticOnly = false } = {}) {
      ctx.clearRect(0, 0, width, height);
      if (!staticOnly) updateNodes();
      links = findLinks(nodes);
      drawLinks(links);
      if (!staticOnly) drawParticles(links);
      drawNodes();
    }

    function animate() {
      drawFrame();
      animationId = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (reducedMotion || animationId !== null) return;
      animationId = window.requestAnimationFrame(animate);
    }

    function stopAnimation() {
      if (animationId !== null) {
        window.cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopAnimation();
      } else {
        startAnimation();
      }
    }

    function handleReducedMotionChange(event) {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stopAnimation();
        drawFrame({ staticOnly: true });
      } else {
        startAnimation();
      }
    }

    function handleResize(nextWidth, nextHeight) {
      const previousWidth = width;
      const previousHeight = height;
      sizeCanvas(nextWidth, nextHeight);
      if (!nodes.length) {
        resetScene();
      } else {
        const scaleX = previousWidth > 1 ? width / previousWidth : 1;
        const scaleY = previousHeight > 1 ? height / previousHeight : 1;
        nodes.forEach((node) => {
          node.x = clamp(node.x * scaleX, node.radius, width - node.radius);
          node.y = clamp(node.y * scaleY, node.radius, height - node.radius);
        });
      }
      drawFrame({ staticOnly: reducedMotion });
    }

    const rect = container.getBoundingClientRect();
    sizeCanvas(rect.width, rect.height);
    resetScene();
    drawFrame({ staticOnly: reducedMotion });
    startAnimation();

    let observer = null;
    const handleWindowResize = () => {
      const nextRect = container.getBoundingClientRect();
      handleResize(nextRect.width, nextRect.height);
    };

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        handleResize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(container);
    } else {
      window.addEventListener("resize", handleWindowResize);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery.addEventListener?.("change", handleReducedMotionChange);

    return () => {
      stopAnimation();
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionQuery.removeEventListener?.("change", handleReducedMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="network-animation-canvas" aria-hidden="true" />;
}
