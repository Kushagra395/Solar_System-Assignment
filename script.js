let scene, camera, renderer;
let planets = {};
let planetSpeeds = {};
let initialPlanetSpeeds = {};
let isPaused = false;
let raycaster, mouse;
let isTopView = false;
let originalCameraPosition = new THREE.Vector3();
let originalCameraRotation = new THREE.Euler();

init();
animate();

function init() {
  const canvas = document.querySelector('#solarSystem');
  scene = new THREE.Scene(); //creating 3d scene

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;
  
  // Store original camera position and rotation
  originalCameraPosition.copy(camera.position);
  originalCameraRotation.copy(camera.rotation);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // point of light from sum 
  const sunLight = new THREE.PointLight(0xffffff, 2, 300);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x333333); //softy faint 
  scene.add(ambientLight);

  // Initialize Raycaster and Mouse Vector for Hover Detection
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Background stars texture
  const loader = new THREE.TextureLoader();
  loader.load('textures/stars.jpg', texture => {
    scene.background = texture;
  });

  // textured sun with brightness
  const sunGeo = new THREE.SphereGeometry(5, 64, 64);
  const sunMat = new THREE.MeshBasicMaterial({ map: loader.load('textures/sun.jpg') });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  const planetData = [
    { name: 'Mercury', size: 0.5, dist: 8, texture: 'mercury.jpg' },
    { name: 'Venus', size: 0.9, dist: 11, texture: 'venus.jpg' },
    { name: 'Earth', size: 1, dist: 14, texture: 'earth.jpg' },
    { name: 'Mars', size: 0.8, dist: 17, texture: 'mars.jpg' },
    { name: 'Jupiter', size: 2.5, dist: 22, texture: 'jupiter.jpg' },
    { name: 'Saturn', size: 2, dist: 27, texture: 'saturn.jpg', hasRing: true },
    { name: 'Uranus', size: 1.5, dist: 32, texture: 'uranus.jpg' },
    { name: 'Neptune', size: 1.5, dist: 37, texture: 'neptune.jpg' },
  ];

  planetData.forEach((data, index) => {
    const geo = new THREE.SphereGeometry(data.size, 64, 64);
    const mat = new THREE.MeshStandardMaterial({
      map: loader.load(`textures/${data.texture}`),
      roughness: 0.8,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = data.name;
    scene.add(mesh);
    planets[data.name] = { mesh, distance: data.dist, angle: 0 };
    planetSpeeds[data.name] = 0.01 + index * 0.002;

    // Store initial speeds for resetting later
    initialPlanetSpeeds[data.name] = planetSpeeds[data.name];

    // Add slider control
    const controlDiv = document.createElement('div');
    controlDiv.innerHTML = `
      <label class="block text-sm mb-1">${data.name} Speed</label>
      <input type="range" min="0" max="1" step="0.001" value="${planetSpeeds[data.name]}"
        id="${data.name}Slider"
        class="slider" />
      <span id="${data.name}SpeedPercent" class="speed-percent">${(planetSpeeds[data.name] * 100).toFixed(1)}%</span>
    `;
    document.getElementById('controls').appendChild(controlDiv);

    document.getElementById(`${data.name}Slider`).addEventListener('input', e => {
      planetSpeeds[data.name] = parseFloat(e.target.value);
      document.getElementById(`${data.name}SpeedPercent`).textContent = `${(planetSpeeds[data.name] * 100).toFixed(1)}%`;
    });
    
    // Add Saturn's ring with texture
    if (data.hasRing) {
      
      const ringInnerRadius = data.size * 1.7;
      const ringOuterRadius = data.size * 2.2;
      const ringSegments = 128;
      
      // Create ring geometry
      const ringGeo = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, ringSegments);
      
      // Create ring material with texture
      const ringMat = new THREE.MeshBasicMaterial({
        map: loader.load('textures/saturn_ring.png'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.name = "Saturn's Ring";
      mesh.add(ring);
      
      //  glow effect for the planet to make relastic
      const ringGlow = new THREE.Mesh(
        new THREE.RingGeometry(ringInnerRadius - 0.1, ringOuterRadius + 0.1, ringSegments),
        new THREE.MeshBasicMaterial({
          color: 0xaaaaaa,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.2
        })
      );
      ringGlow.rotation.x = Math.PI / 2;
      mesh.add(ringGlow);
    }
  });

  // Sidebar toggle function
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
  }

  // Sidebar toggle button
  document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);

  // Close sidebar button
  document.getElementById('close-sidebar').addEventListener('click', toggleSidebar);

  // Pause/Resume button for the plantets
  const pauseResumeBtn = document.getElementById('pauseResumeBtn');
  pauseResumeBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseResumeBtn.textContent = isPaused ? 'Resume' : 'Pause';
  });

  // Reset Speed button
  const resetSpeedBtn = document.getElementById('resetSpeedBtn');
  resetSpeedBtn.addEventListener('click', () => {
    // Reset speeds to initial values
    Object.keys(initialPlanetSpeeds).forEach(name => {
      planetSpeeds[name] = initialPlanetSpeeds[name];
      const slider = document.getElementById(`${name}Slider`);
      const speedPercent = document.getElementById(`${name}SpeedPercent`);
      slider.value = planetSpeeds[name];
      speedPercent.textContent = `${(planetSpeeds[name] * 100).toFixed(1)}%`;
    });
  });

  // Top View Button
  const topViewBtn = document.getElementById('topViewBtn');
  topViewBtn.addEventListener('click', () => {
    isTopView = !isTopView;
    
    if (isTopView) {
      // Switch to top view
      topViewBtn.textContent = 'Normal View';
      
      // Store current position before switching
      originalCameraPosition.copy(camera.position);
      originalCameraRotation.copy(camera.rotation);
      
      // Move camera to top view position
      camera.position.set(0, 100, 0);
      camera.lookAt(0, 0, 0);
    } else {
      // Switch back to normal view
      topViewBtn.textContent = 'Top View';
      
      // Restore original camera position and rotation
      camera.position.copy(originalCameraPosition);
      camera.rotation.copy(originalCameraRotation);
    }
  });

  // Add Zoom functionality
  window.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) {
      camera.fov = Math.min(camera.fov + 1, 120);
    } else {
      camera.fov = Math.max(camera.fov - 1, 30);
    }
    camera.updateProjectionMatrix();
  });

  // Handle mouse movement for hover
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (!isPaused) {
    for (let name in planets) {
      const p = planets[name];
      p.angle += planetSpeeds[name];
      p.mesh.position.x = Math.cos(p.angle) * p.distance; //this will give circular motion around the sun 
      p.mesh.position.z = Math.sin(p.angle) * p.distance;
      
      // Rotate Saturn's ring for added realism
      if (name === 'Saturn') {
        p.mesh.children.forEach(child => {
          if (child.name === "Saturn's Ring") {
            child.rotation.y += 0.001;
          }
        });
      }
    }
  }

  // Raycasting for hover when come mouse hover any pln
  raycaster.setFromCamera(mouse, camera);
 const intersects = raycaster.intersectObjects(Object.values(planets).map(p => p.mesh));

const label = document.getElementById('hoverLabel');
if (intersects.length > 0) {
  const planet = intersects[0].object;
  const planetPos = planet.position.clone();
  planetPos.project(camera);

  const x = (planetPos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-planetPos.y * 0.5 + 0.5) * window.innerHeight;

  label.style.transform = `translate(-50%, -100%)`;
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
  label.textContent = planet.name;
  label.style.display = 'block';
} else {
  label.style.display = 'none';
}

  renderer.render(scene, camera);
}