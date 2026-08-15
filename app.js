(function () {
  "use strict";

  const project = window.PROJECT_DATA;
  const grid = document.querySelector("#comparisonGrid");
  const ablationGrid = document.querySelector("#ablationGrid");
  const previousButton = document.querySelector("#previousScene");
  const nextButton = document.querySelector("#nextScene");

  if (!project || !project.methods || !project.examples || !project.examples.length) {
    grid.textContent = "No gallery examples were found in data.js.";
    return;
  }

  let sceneIndex = 0;
  let animationFrame = 0;
  const openViewports = new Map();

  function playVideo(video, status) {
    video.play().then(function () {
      status.classList.add("is-hidden");
    }).catch(function () {
      status.textContent = "Click to play";
      status.classList.remove("is-hidden");
    });
  }

  function renderViewports() {
    if (!openViewports.size) {
      animationFrame = 0;
      return;
    }

    animationFrame = requestAnimationFrame(renderViewports);
    openViewports.forEach(function (state) {
      state.latitude = THREE.MathUtils.clamp(state.latitude, -85, 85);
      const phi = THREE.MathUtils.degToRad(90 - state.latitude);
      const theta = THREE.MathUtils.degToRad(state.longitude);
      state.camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      try {
        state.renderer.render(state.scene, state.camera);
      } catch (error) {
        state.status.textContent = "The browser blocked this video from being used as a WebGL texture.";
        state.status.classList.remove("is-hidden");
      }
    });
  }

  function closeViewport(video) {
    const state = openViewports.get(video);
    if (!state) return;

    state.resizeObserver.disconnect();
    state.texture.dispose();
    state.geometry.dispose();
    state.material.dispose();
    state.renderer.dispose();
    state.canvas.remove();
    state.video.classList.remove("is-source-only");
    state.backButton.hidden = true;
    openViewports.delete(video);
    playVideo(state.video, state.status);
  }

  function closeAllViewports() {
    [...openViewports.keys()].forEach(closeViewport);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function openViewport(video, mediaFrame, backButton, status) {
    if (openViewports.has(video)) return;

    if (window.location.protocol === "file:") {
      status.textContent = "360° view requires GitHub Pages or a local HTTP server (not file://).";
      status.classList.remove("is-hidden");
      return;
    }

    if (!window.THREE) {
      status.textContent = "The 360° viewer library could not be loaded.";
      status.classList.remove("is-hidden");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "viewport-canvas";
    canvas.setAttribute("aria-label", "Interactive 360-degree viewport");
    mediaFrame.append(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 1200);
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.encoding = THREE.sRGBEncoding;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material));

    const state = {
      backButton: backButton,
      camera: camera,
      canvas: canvas,
      geometry: geometry,
      latitude: 0,
      longitude: 0,
      material: material,
      renderer: renderer,
      resizeObserver: null,
      scene: scene,
      status: status,
      texture: texture,
      video: video,
    };

    function resize() {
      const width = mediaFrame.clientWidth;
      const height = mediaFrame.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLongitude = 0;
    let startLatitude = 0;

    canvas.addEventListener("pointerdown", function (event) {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLongitude = state.longitude;
      startLatitude = state.latitude;
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      state.longitude = startLongitude + (startX - event.clientX) * 0.16;
      state.latitude = startLatitude + (event.clientY - startY) * 0.16;
    });

    function stopDragging(event) {
      dragging = false;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();
        camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.035, 35, 90);
        camera.updateProjectionMatrix();
      },
      { passive: false },
    );

    state.resizeObserver = new ResizeObserver(resize);
    state.resizeObserver.observe(mediaFrame);
    video.classList.add("is-source-only");
    backButton.hidden = false;
    status.classList.add("is-hidden");
    openViewports.set(video, state);
    playVideo(video, status);
    resize();

    if (!animationFrame) renderViewports();
  }

  function createMethodCard(method, source, cardIndex, idPrefix) {
    const card = document.createElement("article");
    card.className = "video-card";
    if (method.caption) card.classList.add("has-caption");

    const title = document.createElement("h3");
    title.textContent = method.label;

    const mediaFrame = document.createElement("div");
    mediaFrame.className = "media-frame";

    const video = document.createElement("video");
    video.id = (idPrefix || "scene-" + sceneIndex) + "-method-" + cardIndex;
    video.src = source;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.draggable = false;
    video.disablePictureInPicture = true;
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute(
      "aria-label",
      method.label + " equirectangular video. Click to view in 360 degrees.",
    );

    const status = document.createElement("button");
    status.className = "video-status";
    status.type = "button";
    status.textContent = "Loading video…";

    const backButton = document.createElement("button");
    backButton.className = "back-button";
    backButton.type = "button";
    backButton.textContent = "Go back to equirectangular";
    backButton.hidden = true;

    const actionSlot = document.createElement("div");
    actionSlot.className = "viewport-action-slot";
    actionSlot.append(backButton);
    if (method.caption) actionSlot.classList.add("is-overlay");

    let caption = null;
    if (method.caption) {
      caption = document.createElement("p");
      caption.className = "ablation-caption";
      const captionName = document.createElement("em");
      captionName.textContent = method.label;
      caption.append(captionName, document.createTextNode(" " + method.caption));
    }

    video.addEventListener("loadedmetadata", function () {
      if (video.videoWidth && video.videoHeight) {
        mediaFrame.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
      }
    });

    video.addEventListener("loadeddata", function () {
      playVideo(video, status);
    });

    video.addEventListener("canplay", function () {
      status.classList.add("is-hidden");
    });

    video.addEventListener("error", function () {
      status.textContent = "Video could not be loaded";
      status.classList.remove("is-hidden");
    });

    video.addEventListener("click", function () {
      openViewport(video, mediaFrame, backButton, status);
    });

    status.addEventListener("click", function () {
      playVideo(video, status);
    });

    backButton.addEventListener("click", function () {
      closeViewport(video);
    });

    mediaFrame.append(video, status);
    if (method.caption) {
      mediaFrame.append(actionSlot);
      card.append(title, mediaFrame);
    } else {
      card.append(title, mediaFrame, actionSlot);
    }
    if (caption) card.append(caption);
    return card;
  }

  function createPlaceholderCard(method) {
    const card = document.createElement("article");
    card.className = "video-card";
    if (method.caption) card.classList.add("has-caption");

    const title = document.createElement("h3");
    title.textContent = method.label;

    const placeholder = document.createElement("div");
    placeholder.className = "media-frame placeholder-frame";
    placeholder.setAttribute("role", "status");
    placeholder.textContent = "Coming soon";

    card.append(title, placeholder);
    if (method.caption) {
      const caption = document.createElement("p");
      caption.className = "ablation-caption";
      const captionName = document.createElement("em");
      captionName.textContent = method.label;
      caption.append(captionName, document.createTextNode(" " + method.caption));
      card.append(caption);
    }
    return card;
  }

  function createInputCard(source) {
    const card = document.createElement("article");
    card.className = "video-card input-card";

    const title = document.createElement("h3");
    title.textContent = "Input perspective video";

    const mediaFrame = document.createElement("div");
    mediaFrame.className = "media-frame";

    const video = document.createElement("video");
    video.src = source;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.draggable = false;
    video.disablePictureInPicture = true;
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("aria-label", "Input perspective video");

    const status = document.createElement("button");
    status.className = "video-status";
    status.type = "button";
    status.textContent = "Loading video…";

    video.addEventListener("loadedmetadata", function () {
      if (video.videoWidth && video.videoHeight) {
        const inputAspectRatio = video.videoWidth / video.videoHeight;
        const widthForPanoramaHeight = Math.min(100, (inputAspectRatio / 2) * 100);
        mediaFrame.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
        mediaFrame.style.width = widthForPanoramaHeight + "%";
      }
    });

    video.addEventListener("loadeddata", function () {
      playVideo(video, status);
    });

    video.addEventListener("canplay", function () {
      status.classList.add("is-hidden");
    });

    video.addEventListener("error", function () {
      status.textContent = "Video could not be loaded";
      status.classList.remove("is-hidden");
    });

    status.addEventListener("click", function () {
      playVideo(video, status);
    });

    mediaFrame.append(video, status);
    card.append(title, mediaFrame);
    return card;
  }

  function renderScene() {
    closeAllViewports();
    const example = project.examples[sceneIndex];
    grid.replaceChildren();

    if (example.input) grid.appendChild(createInputCard(example.input));

    project.methods.forEach(function (method, index) {
      const source = example.videos[method.id];
      if (source) grid.appendChild(createMethodCard(method, source, index));
    });
  }

  function moveScene(direction) {
    sceneIndex = (sceneIndex + direction + project.examples.length) % project.examples.length;
    renderScene();
  }

  function renderAblations() {
    if (!ablationGrid || !project.ablations) return;

    ablationGrid.replaceChildren();
    if (project.ablations.input) {
      ablationGrid.appendChild(createInputCard(project.ablations.input));
    }

    project.ablations.methods.forEach(function (method, index) {
      if (method.source) {
        ablationGrid.appendChild(createMethodCard(method, method.source, index, "ablation"));
      } else {
        ablationGrid.appendChild(createPlaceholderCard(method));
      }
    });
  }

  previousButton.addEventListener("click", function () {
    moveScene(-1);
  });

  nextButton.addEventListener("click", function () {
    moveScene(1);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") moveScene(-1);
    if (event.key === "ArrowRight") moveScene(1);
  });

  renderScene();
  renderAblations();
})();
