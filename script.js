import createGlobe from "https://esm.sh/cobe@2.0.1";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("globeCanvas");
  const asteroidCanvas = document.getElementById("asteroidBackground");
  const emailElement = document.getElementById("email");
  const toast = document.getElementById("toast");
  const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));

  initAsteroidBackground();
  initNavInteractions();
  initScrollReveals();
  initAboutTypewriter();

  if (!canvas) {
    console.error("Canvas not found");
    return;
  }

  let globe = null;
  let phi = 0;
  let theta = 0.3;
  let animationId = null;
  let animateGlobe = null;
  let globeVisible = true;
  let toastTimer = null;

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragVelocityX = 0;
  let dragVelocityY = 0;
  const globeDpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function initAsteroidBackground() {
    if (!asteroidCanvas) return;

    const ctx = asteroidCanvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars = [];
    let asteroids = [];
    let debris = [];
    let comet = null;
    let nextCometAt = 0;
    let backgroundFrameId = null;
    let lastFrameTime = 0;
    let isBackgroundRunning = false;
    const frameInterval = 1000 / 30;

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function createAsteroid() {
      const radius = randomBetween(18, 58);
      const points = Array.from({ length: 9 }, (_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        const scale = randomBetween(0.72, 1.18);
        return {
          x: Math.cos(angle) * radius * scale,
          y: Math.sin(angle) * radius * scale
        };
      });

      return {
        x: randomBetween(-radius, width + radius),
        y: randomBetween(-radius, height + radius),
        vx: randomBetween(-0.12, 0.12),
        vy: randomBetween(0.05, 0.22),
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.002, 0.002),
        trail: randomBetween(18, 42),
        radius,
        points
      };
    }

    function createStar() {
      return {
        x: randomBetween(0, width),
        y: randomBetween(0, height),
        size: randomBetween(0.6, 1.8),
        alpha: randomBetween(0.18, 0.68),
        drift: randomBetween(0.02, 0.08),
        phase: randomBetween(0, Math.PI * 2),
        twinkle: randomBetween(0.0018, 0.004)
      };
    }

    function createDebris() {
      return {
        x: randomBetween(0, width),
        y: randomBetween(0, height),
        vx: randomBetween(-0.18, -0.04),
        vy: randomBetween(0.1, 0.32),
        size: randomBetween(0.8, 1.8),
        length: randomBetween(8, 22),
        alpha: randomBetween(0.14, 0.38)
      };
    }

    function createComet() {
      const fromLeft = Math.random() > 0.35;
      return {
        x: fromLeft ? randomBetween(-120, width * 0.72) : randomBetween(width * 0.28, width + 120),
        y: randomBetween(-90, height * 0.42),
        vx: fromLeft ? randomBetween(3.2, 5.1) : randomBetween(-5.1, -3.2),
        vy: randomBetween(1.1, 2.2),
        length: randomBetween(110, 190),
        width: randomBetween(1.2, 2.2),
        alpha: randomBetween(0.55, 0.82)
      };
    }

    function resizeAsteroidCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      asteroidCanvas.width = Math.floor(width * dpr);
      asteroidCanvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const starCount = Math.min(78, Math.max(36, Math.floor(width / 18)));
      const asteroidCount = Math.min(8, Math.max(4, Math.floor(width / 235)));
      const debrisCount = Math.min(28, Math.max(10, Math.floor(width / 70)));

      stars = Array.from({ length: starCount }, createStar);
      asteroids = Array.from({ length: asteroidCount }, createAsteroid);
      debris = Array.from({ length: debrisCount }, createDebris);
      comet = null;
      nextCometAt = performance.now() + randomBetween(700, 1800);
    }

    function drawShip(timestamp = 0) {
      const x = width * 0.82;
      const y = height * 0.2;
      const size = Math.max(18, Math.min(30, width * 0.025));
      const flame = 0.55 + Math.sin(timestamp * 0.008) * 0.35;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.4);

      ctx.strokeStyle = `rgba(34, 197, 94, ${0.18 + flame * 0.22})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-size * 0.72, 0);
      ctx.lineTo(-size * (1.05 + flame * 0.28), 0);
      ctx.stroke();

      ctx.strokeStyle = "rgba(248, 250, 252, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.72, -size * 0.55);
      ctx.lineTo(-size * 0.42, 0);
      ctx.lineTo(-size * 0.72, size * 0.55);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function drawAsteroid(asteroid) {
      const speed = Math.hypot(asteroid.vx, asteroid.vy) || 1;

      ctx.save();
      ctx.strokeStyle = "rgba(103, 232, 249, 0.1)";
      ctx.lineWidth = Math.max(1, asteroid.radius * 0.04);
      ctx.beginPath();
      ctx.moveTo(
        asteroid.x - (asteroid.vx / speed) * asteroid.trail,
        asteroid.y - (asteroid.vy / speed) * asteroid.trail
      );
      ctx.lineTo(asteroid.x, asteroid.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      ctx.rotate(asteroid.rotation);
      ctx.fillStyle = "rgba(103, 232, 249, 0.035)";
      ctx.strokeStyle = "rgba(103, 232, 249, 0.42)";
      ctx.shadowColor = "rgba(103, 232, 249, 0.36)";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.35;
      ctx.beginPath();

      asteroid.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "rgba(248, 250, 252, 0.16)";
      ctx.beginPath();
      ctx.moveTo(-asteroid.radius * 0.3, -asteroid.radius * 0.1);
      ctx.lineTo(asteroid.radius * 0.15, -asteroid.radius * 0.22);
      ctx.lineTo(asteroid.radius * 0.32, asteroid.radius * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    function drawDebrisPiece(piece) {
      ctx.strokeStyle = `rgba(103, 232, 249, ${piece.alpha})`;
      ctx.lineWidth = piece.size;
      ctx.beginPath();
      ctx.moveTo(piece.x, piece.y);
      ctx.lineTo(piece.x - piece.vx * piece.length, piece.y - piece.vy * piece.length);
      ctx.stroke();
    }

    function drawComet(activeComet) {
      const speed = Math.hypot(activeComet.vx, activeComet.vy) || 1;
      const tailX = activeComet.x - (activeComet.vx / speed) * activeComet.length;
      const tailY = activeComet.y - (activeComet.vy / speed) * activeComet.length;
      const gradient = ctx.createLinearGradient(tailX, tailY, activeComet.x, activeComet.y);

      gradient.addColorStop(0, "rgba(103, 232, 249, 0)");
      gradient.addColorStop(0.65, `rgba(103, 232, 249, ${activeComet.alpha * 0.55})`);
      gradient.addColorStop(1, `rgba(248, 250, 252, ${activeComet.alpha})`);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = gradient;
      ctx.lineWidth = activeComet.width;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(activeComet.x, activeComet.y);
      ctx.stroke();

      ctx.fillStyle = `rgba(248, 250, 252, ${activeComet.alpha})`;
      ctx.beginPath();
      ctx.arc(activeComet.x, activeComet.y, activeComet.width * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBackground(timestamp = 0) {
      if (!isBackgroundRunning && !reducedMotion.matches) return;

      if (!reducedMotion.matches && timestamp - lastFrameTime < frameInterval) {
        backgroundFrameId = requestAnimationFrame(drawBackground);
        return;
      }

      lastFrameTime = timestamp;
      ctx.clearRect(0, 0, width, height);

      stars.forEach((star) => {
        const twinkle = reducedMotion.matches ? 0 : Math.sin(timestamp * star.twinkle + star.phase) * 0.14;
        const alpha = Math.max(0.12, Math.min(0.86, star.alpha + twinkle));

        ctx.fillStyle = `rgba(248, 250, 252, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        if (!reducedMotion.matches) {
          star.y += star.drift;
          if (star.y > height + 4) {
            star.y = -4;
            star.x = randomBetween(0, width);
          }
        }
      });

      debris.forEach((piece) => {
        drawDebrisPiece(piece);

        if (!reducedMotion.matches) {
          piece.x += piece.vx;
          piece.y += piece.vy;

          if (piece.y > height + piece.length || piece.x < -piece.length) {
            piece.x = randomBetween(width * 0.2, width + 40);
            piece.y = randomBetween(-40, height * 0.9);
          }
        }
      });

      asteroids.forEach((asteroid) => {
        drawAsteroid(asteroid);

        if (!reducedMotion.matches) {
          asteroid.x += asteroid.vx;
          asteroid.y += asteroid.vy;
          asteroid.rotation += asteroid.rotationSpeed;

          if (asteroid.y > height + asteroid.radius) {
            asteroid.y = -asteroid.radius;
            asteroid.x = randomBetween(-asteroid.radius, width + asteroid.radius);
          }

          if (asteroid.x < -asteroid.radius) {
            asteroid.x = width + asteroid.radius;
          } else if (asteroid.x > width + asteroid.radius) {
            asteroid.x = -asteroid.radius;
          }
        }
      });

      if (!reducedMotion.matches) {
        if (!comet && timestamp > nextCometAt) {
          comet = createComet();
        }

        if (comet) {
          drawComet(comet);
          comet.x += comet.vx;
          comet.y += comet.vy;

          if (
            comet.y > height + comet.length ||
            comet.x < -comet.length ||
            comet.x > width + comet.length
          ) {
            comet = null;
            nextCometAt = timestamp + randomBetween(1700, 3600);
          }
        }
      }

      drawShip(timestamp);

      if (!reducedMotion.matches && isBackgroundRunning) {
        backgroundFrameId = requestAnimationFrame(drawBackground);
      }
    }

    function startBackground() {
      if (reducedMotion.matches || isBackgroundRunning) return;
      isBackgroundRunning = true;
      lastFrameTime = 0;
      backgroundFrameId = requestAnimationFrame(drawBackground);
    }

    function stopBackground() {
      isBackgroundRunning = false;

      if (backgroundFrameId) {
        cancelAnimationFrame(backgroundFrameId);
        backgroundFrameId = null;
      }
    }

    resizeAsteroidCanvas();
    if (reducedMotion.matches) {
      drawBackground();
    } else {
      startBackground();
    }

    window.addEventListener("resize", () => {
      resizeAsteroidCanvas();
      if (reducedMotion.matches) {
        drawBackground();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopBackground();
        return;
      }

      if (reducedMotion.matches) {
        drawBackground();
      } else {
        startBackground();
      }
    });
  }

  function showToast(message) {
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  }

  function initNavInteractions() {
    const navTargets = navLinks
      .map((link) => ({
        link,
        target: document.querySelector(link.getAttribute("href"))
      }))
      .filter(({ target }) => target);

    if (!navTargets.length) return;

    function setActiveLink(activeLink) {
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link === activeLink);
      });
    }

    function spotlightSection(target) {
      target.classList.remove("section-spotlight");
      void target.offsetWidth;
      target.classList.add("section-spotlight");

      clearTimeout(target.spotlightTimer);
      target.spotlightTimer = setTimeout(() => {
        target.classList.remove("section-spotlight");
      }, 1100);
    }

    navTargets.forEach(({ link, target }) => {
      link.addEventListener("click", (event) => {
        const rect = link.getBoundingClientRect();
        const rippleX = event.clientX ? event.clientX - rect.left : rect.width / 2;
        const rippleY = event.clientY ? event.clientY - rect.top : rect.height / 2;

        link.style.setProperty("--ripple-x", `${rippleX}px`);
        link.style.setProperty("--ripple-y", `${rippleY}px`);
        link.classList.remove("nav-link-pulse");
        void link.offsetWidth;
        link.classList.add("nav-link-pulse");

        setActiveLink(link);
        setTimeout(() => spotlightSection(target), 420);
      });

      link.addEventListener("animationend", () => {
        link.classList.remove("nav-link-pulse");
      });
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const match = navTargets.find(({ target }) => target === entry.target);
            if (match) {
              setActiveLink(match.link);
            }
          });
        },
        {
          rootMargin: "-35% 0px -50% 0px",
          threshold: 0.1
        }
      );

      navTargets.forEach(({ target }) => observer.observe(target));
    }
  }

  function initScrollReveals() {
    const sectionTitles = Array.from(document.querySelectorAll("main .section h2, .globe-text h3"));
    const revealItems = Array.from(
      document.querySelectorAll(
        ".about-section > p, .globe-container, .globe-text, .education-card, .project-card, .skill-card, .skills-support span, #contact p"
      )
    );
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    sectionTitles.forEach((title) => {
      const words = title.textContent.trim().split(/\s+/);
      title.textContent = "";
      title.classList.add("section-title");

      words.forEach((word, index) => {
        const span = document.createElement("span");
        span.className = "reveal-word";
        span.style.setProperty("--word-index", index);
        span.textContent = word;
        title.append(span);

        if (index < words.length - 1) {
          title.append(document.createTextNode(" "));
        }
      });
    });

    revealItems.forEach((item, index) => {
      item.classList.add("scroll-reveal");
      item.style.setProperty("--reveal-delay", `${(index % 3) * 20}ms`);
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      [...sectionTitles, ...revealItems].forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          clearTimeout(entry.target.revealResetTimer);

          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            return;
          }

          const rect = entry.target.getBoundingClientRect();
          const isFarOutsideViewport = rect.bottom < -40 || rect.top > window.innerHeight + 40;

          if (!isFarOutsideViewport) return;

          entry.target.revealResetTimer = setTimeout(() => {
            entry.target.classList.remove("is-visible");
          }, 80);
        });
      },
      {
        rootMargin: "40px 0px 40px 0px",
        threshold: 0.01
      }
    );

    [...sectionTitles, ...revealItems].forEach((item) => observer.observe(item));
  }

  function initAboutTypewriter() {
    const typewriter = document.querySelector("[data-typewriter]");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!typewriter) return;

    const text = typewriter.textContent.replace(/\s+/g, " ").trim();
    const output = document.createElement("span");
    const cursor = document.createElement("span");

    typewriter.setAttribute("aria-label", text);
    typewriter.textContent = "";
    output.className = "typewriter-output";
    output.setAttribute("aria-hidden", "true");
    cursor.className = "typewriter-cursor";
    cursor.setAttribute("aria-hidden", "true");
    typewriter.append(output, cursor);

    if (prefersReducedMotion) {
      output.textContent = text;
      cursor.hidden = true;
      typewriter.classList.add("is-typed");
      return;
    }

    const characters = [...text];
    let index = 0;
    let hasStarted = false;

    function typeNextCharacter() {
      const character = characters[index];

      if (!character) {
        typewriter.classList.remove("is-typing");
        typewriter.classList.add("is-typed");
        return;
      }

      const chunkSize = /[.,]/.test(character) ? 1 : 2;
      output.textContent += characters.slice(index, index + chunkSize).join("");
      index += chunkSize;

      const delay = /[.,]/.test(character) ? 110 : 26;
      setTimeout(typeNextCharacter, delay);
    }

    function startTyping() {
      if (hasStarted) return;
      hasStarted = true;
      typewriter.classList.add("is-typing");
      typeNextCharacter();
    }

    if (!("IntersectionObserver" in window)) {
      startTyping();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          startTyping();
          observer.disconnect();
        });
      },
      {
        threshold: 0.35
      }
    );

    observer.observe(typewriter);
  }

  function destroyGlobe() {
    stopGlobeAnimation();

    if (globe) {
      globe.destroy();
      globe = null;
    }
  }

  function startGlobeAnimation() {
    if (!animateGlobe || animationId || !globeVisible || document.hidden) return;
    animationId = requestAnimationFrame(animateGlobe);
  }

  function stopGlobeAnimation() {
    if (!animationId) return;
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  function wrapPhi(value) {
    const fullTurn = Math.PI * 2;
    return ((value % fullTurn) + fullTurn) % fullTurn;
  }

  function clampTheta(value) {
    const limit = Math.PI / 2 - 0.05;
    return Math.max(-limit, Math.min(limit, value));
  }

  function buildGlobe() {
    const width = Math.floor(canvas.clientWidth);
    const height = Math.floor(canvas.clientHeight);

    if (!width || !height) {
      console.warn("Canvas has no size yet");
      return;
    }

    if (globe) {
      globe.update({ width, height, phi, theta });
      return;
    }

    canvas.width = width * globeDpr;
    canvas.height = height * globeDpr;

    globe = createGlobe(canvas, {
      devicePixelRatio: globeDpr,
      width,
      height,
      phi,
      theta,
      dark: 1,
      diffuse: 1.2,
      scale: 1,
      mapSamples: width < 640 ? 3000 : 4200,
      mapBrightness: 5,
      baseColor: [0.1, 0.18, 0.35],
      markerColor: [0.4, 0.85, 1],
      glowColor: [0.2, 0.6, 1],
      arcColor: [0.4, 0.85, 1],
      arcWidth: 1.35,
      arcHeight: 0.28,
      markerElevation: 0.06,

      markers: [
        { location: [51.5074, -0.1278], size: 0.06 },
        { location: [40.7128, -74.006], size: 0.045 },
        { location: [43.6532, -79.3832], size: 0.04 },
        { location: [37.7749, -122.4194], size: 0.04 },
        { location: [52.52, 13.405], size: 0.04 },
        { location: [28.6139, 77.209], size: 0.05 },
        { location: [1.3521, 103.8198], size: 0.045 },
        { location: [25.276987, 55.296249], size: 0.045 },
        { location: [35.6762, 139.6503], size: 0.04 },
        { location: [-33.8688, 151.2093], size: 0.04 },
        { location: [-33.9249, 18.4241], size: 0.04 },
        { location: [-23.5505, -46.6333], size: 0.04 }
      ],

      arcs: [
        {
          from: [51.5074, -0.1278],
          to: [40.7128, -74.006],
          color: [0.4, 0.85, 1]
        },
        {
          from: [51.5074, -0.1278],
          to: [43.6532, -79.3832],
          color: [0.45, 0.9, 1]
        },
        {
          from: [40.7128, -74.006],
          to: [37.7749, -122.4194],
          color: [0.55, 0.78, 1]
        },
        {
          from: [51.5074, -0.1278],
          to: [28.6139, 77.209],
          color: [0.55, 0.7, 1]
        },
        {
          from: [51.5074, -0.1278],
          to: [52.52, 13.405],
          color: [0.6, 0.95, 1]
        },
        {
          from: [51.5074, -0.1278],
          to: [25.276987, 55.296249],
          color: [0.48, 0.82, 1]
        },
        {
          from: [28.6139, 77.209],
          to: [1.3521, 103.8198],
          color: [0.4, 0.85, 1]
        },
        {
          from: [25.276987, 55.296249],
          to: [1.3521, 103.8198],
          color: [0.45, 0.9, 1]
        },
        {
          from: [1.3521, 103.8198],
          to: [35.6762, 139.6503],
          color: [0.5, 0.95, 1]
        },
        {
          from: [35.6762, 139.6503],
          to: [-33.8688, 151.2093],
          color: [0.65, 0.85, 1]
        },
        {
          from: [51.5074, -0.1278],
          to: [-33.9249, 18.4241],
          color: [0.42, 0.88, 1]
        },
        {
          from: [-23.5505, -46.6333],
          to: [51.5074, -0.1278],
          color: [0.55, 0.78, 1]
        },
        {
          from: [-23.5505, -46.6333],
          to: [-33.9249, 18.4241],
          color: [0.38, 0.86, 1]
        }
      ]
    });

    function animate() {
      if (!globeVisible || document.hidden) {
        animationId = null;
        return;
      }

      if (!isDragging) {
        phi = wrapPhi(phi + 0.0015);

        if (Math.abs(dragVelocityX) > 0.00001) {
          phi = wrapPhi(phi + dragVelocityX);
          dragVelocityX *= 0.92;
        }

        if (Math.abs(dragVelocityY) > 0.00001) {
          theta = clampTheta(theta + dragVelocityY);
          dragVelocityY *= 0.92;
        }
      }

      if (globe) {
        globe.update({ phi, theta });
      }

      animationId = requestAnimationFrame(animate);
    }

    animateGlobe = animate;
    startGlobeAnimation();
  }

  function startDrag(x, y) {
    isDragging = true;
    lastX = x;
    lastY = y;
    dragVelocityX = 0;
    dragVelocityY = 0;
    canvas.style.cursor = "grabbing";
  }

  function moveDrag(x, y) {
    if (!isDragging) return;

    const deltaX = x - lastX;
    const deltaY = y - lastY;

    const rotationSpeed = 0.005;
    const tiltSpeed = 0.004;

    phi = wrapPhi(phi + deltaX * rotationSpeed);
    theta = clampTheta(theta - deltaY * tiltSpeed);

    dragVelocityX = deltaX * rotationSpeed * 0.35;
    dragVelocityY = -deltaY * tiltSpeed * 0.35;

    lastX = x;
    lastY = y;
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = "grab";
  }

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", (e) => {
    moveDrag(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", endDrag);
  window.addEventListener("mouseleave", endDrag);

  canvas.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      startDrag(touch.clientX, touch.clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      moveDrag(touch.clientX, touch.clientY);
    },
    { passive: true }
  );

  window.addEventListener("touchend", endDrag);
  window.addEventListener("touchcancel", endDrag);

  if (emailElement) {
    emailElement.addEventListener("click", async () => {
      const email = "kumartharun2612@gmail.com";

      try {
        await navigator.clipboard.writeText(email);
        showToast("Email copied");
      } catch (err) {
        console.error("Copy failed", err);
        showToast("Failed to copy");
      }
    });
  }

  if ("IntersectionObserver" in window) {
    const globeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          globeVisible = entry.isIntersecting;

          if (globeVisible) {
            requestAnimationFrame(buildGlobe);
            startGlobeAnimation();
            return;
          }

          stopGlobeAnimation();
        });
      },
      {
        rootMargin: "160px 0px 160px 0px",
        threshold: 0.01
      }
    );

    globeObserver.observe(canvas);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGlobeAnimation();
      return;
    }

    startGlobeAnimation();
  });

  requestAnimationFrame(buildGlobe);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      requestAnimationFrame(buildGlobe);
    }, 150);
  });
});
