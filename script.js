import { setupDrawingCanvas, initializeApp, showConfusion} from './mnist.js';
window.centerNeuralNetwork = centerNeuralNetwork;
window.startNodeColorAnimation = startNodeColorAnimation;
window.stopNodeColorAnimation = stopNodeColorAnimation;
window.enableOtherFunctionality = enableOtherFunctionality;
let scene, camera, renderer, particles, raycaster, mouse, nodes, edges = [];
let hoveredNode = null;
let neuralNetworkGroup; // New group to hold the entire neural network
let targetRotation = new THREE.Euler(); // Target rotation for smooth transition
let customCursor;
let cursorTriangle;
let cursorParticles = [];
//for cursor particles
let lastX = 0;
let lastY = 0;
let nodeData = {};

let nodeColorAnimationId;


fetch('nodeData.json')
    .then(response => response.json())
    .then(data => {
        nodeData = data;
    })
    .catch(error => console.error('Error loading node data:', error));


function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    //cursor init
    customCursor = document.getElementById('custom-cursor');
    cursorTriangle = document.getElementById('cursor-triangle');
    document.addEventListener('mousemove', updateCustomCursor);

    camera.position.set(0, 0, 4);
    addNeonText(scene, camera);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createParticles();
    createNeuralNetwork();

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onClick, false);
    //arrow code
    const dir = new THREE.Vector3( 2, -1, 0 );
    //normalize the direction vector (convert to vector of length 1)
    dir.normalize();

    const origin = new THREE.Vector3( -4.5, 0.8, 0);
    const length = 1;
    const hex = 0xFFD633;

    const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
    arrowHelper.setLength(1 , 0.3, 0.2);
    scene.add( arrowHelper );

    animate();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 1000; i++) {
        vertices.push(
            Math.random() * 2000 - 1000,
            Math.random() * 2000 - 1000,
            Math.random() * 2000 - 1000
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2 });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}


function createNeuralNetwork() {
    neuralNetworkGroup = new THREE.Group(); // Create a group for the neural network
    scene.add(neuralNetworkGroup);
    const nodeGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const layerSizes = [1, 2, 3, 1, 1];
    const layerSpacing = 1.5;
    nodes = [];

    // Create glow material
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            c: { type: "f", value: 0.7 },
            p: { type: "f", value: 0.7 },
            glowColor: { type: "c", value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
            uniform float c;
            uniform float p;
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                vec3 vNormel = normalize(normalMatrix * vec3(position));
                intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 0.6)), p);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            varying float intensity;
            void main() {
                vec3 glow = glowColor * intensity;
                gl_FragColor = vec4(glow, 5);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    layerSizes.forEach((size, layerIndex) => {
        for (let i = 0; i < size; i++) {
            const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone()); // Clone the material for individual control
            const x = layerIndex * layerSpacing - (layerSizes.length - 1) * layerSpacing / 2;
            const y = (i - (size - 1) / 2) * 1.2;
            node.position.set(x, y, 0);
            node.originalScale = node.scale.clone(); // Store original scale
            neuralNetworkGroup.add(node); // Add to group instead of scene
            nodes.push(node);

            node.nodeInfo = {
                id: `Node-${layerIndex}-${i}`,
                position: `[${x.toFixed(2)}, ${y.toFixed(2)}, 0.00]`
            }

            // Add glow effect
            const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.175, 32, 32), glowMaterial);
            glowMesh.position.set(x, y, 0);
            neuralNetworkGroup.add(glowMesh); // Add to group instead of scene
            node.glowMesh = glowMesh; // Associate glow mesh with node
        }
    });

    // Create edges between nodes
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFA500 });
    const glowEdgeMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFD633,
        transparent: true,
        opacity: 0.2
    });

    for (let i = 0; i < layerSizes.length - 1; i++) {
        for (let j = 0; j < layerSizes[i]; j++) {
            for (let k = 0; k < layerSizes[i + 1]; k++) {
                const startNodeIndex = layerSizes.slice(0, i).reduce((a, b) => a + b, 0) + j;
                const endNodeIndex = layerSizes.slice(0, i + 1).reduce((a, b) => a + b, 0) + k;
               
                const startNode = nodes[startNodeIndex];
                const endNode = nodes[endNodeIndex];

                const direction = new THREE.Vector3().subVectors(endNode.position, startNode.position);
                const edgeLength = direction.length()-0.5;
                const edgeGeometry = new THREE.CylinderGeometry(0.03, 0.03, edgeLength, 8);
                
                const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
                edge.position.copy(startNode.position);
                edge.position.lerp(endNode.position, 0.5);
                edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
                neuralNetworkGroup.add(edge); // Add to group instead of scene
                edges.push(edge); // Store the edge

                // Add glow effect to edges
                const glowEdgeGeometry = new THREE.CylinderGeometry(0.1, 0.1, edgeLength, 8);
                const glowEdge = new THREE.Mesh(glowEdgeGeometry, glowEdgeMaterial);
                glowEdge.position.copy(edge.position);
                glowEdge.quaternion.copy(edge.quaternion);
                neuralNetworkGroup.add(glowEdge); // Add to group instead of scene
                edges.push(glowEdge); // Store the glow edge
            }
        }
    }
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCustomCursor(event) {
    customCursor.style.left = event.clientX + 'px';
    customCursor.style.top = event.clientY + 'px';
    //for cursor particles
    const speed = Math.sqrt(Math.pow(event.clientX - lastX, 2) + Math.pow(event.clientY - lastY, 2));
    const particleCount = Math.floor(speed / 1.6);

    for (let i = 0; i < particleCount; i++) {
        createParticle(event.clientX, event.clientY, speed);
    }

    lastX = event.clientX;
    lastY = event.clientY;
}


function onClick(event) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);

    if (intersects.length > 0) {
        showInfoPopup(intersects[0].object);
    }

    /*
    closeButton.onclick = () => {
        popup.style.display = 'none';
    };
    */
}


async function showInfoPopup(node) {
    const popup = document.getElementById('info-popup');
    const {id, position} = node.nodeInfo;
    popup.style.display = 'block';

    let content = `
        <h2>Node Data</h2>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>Position:</strong> ${position}</p>
    `;

    if (id && nodeData[id]) {
        content += nodeData[id].content.join('\n');
    } else {
        content += `
            <h2>Unknown Node</h2>
            <p>No data available for this node.</p>
        `;
    }

    popup.innerHTML = content;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close Connection';
    closeButton.classList.add('popup-close-button');
    
    closeButton.onclick = () => {
        popup.style.display = 'none';
    };
  
    popup.appendChild(closeButton);

    if (id === "Node-0-0") {
        //await runNeuralNetwork();
        initializeApp();
    }

    if (id === "Node-4-0") {
        //await runNeuralNetwork();
        setupDrawingCanvas();
        showConfusion();
    }
}


function onMouseMove(event) {
    // Update custom cursor
    updateCustomCursor(event);

    // Update mouse position for 3D scene
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update target rotation based on mouse position
    targetRotation.y = mouse.x * 0.25; // Rotate around Y-axis
    targetRotation.x = -mouse.y * 0.25; // Tilt around X-axis

    // Raycasting for node hover effect
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);

    if (intersects.length > 0) {
        if (hoveredNode !== intersects[0].object) {
            if (hoveredNode) resetNodeAppearance(hoveredNode);
            hoveredNode = intersects[0].object;
            setNodeHoverAppearance(hoveredNode);
            setGlowColor('#ff0000');
        }
        cursorTriangle.style.borderBottomColor = '#ff0000'; // Red color when hovering over a node
        cursorTriangle.style.setProperty('--glow-color', '#ff0000');
    } else {
        if (hoveredNode) {
            resetNodeAppearance(hoveredNode);
            hoveredNode = null;
        }
        cursorTriangle.style.borderBottomColor = 'white'; // Reset color
        cursorTriangle.style.setProperty('--glow-color', '#00ff00');
        setGlowColor('#00ff00');
    }


}

function setGlowColor(color) {
    const style = document.createElement('style');
    style.textContent = `
        #cursor-triangle::after {
            border-bottom-color: ${color} !important;
        }
    `;
    document.head.appendChild(style);
}


function setNodeHoverAppearance(node) {
    // Change color (hue shift)
    let color = new THREE.Color(node.material.color);
    color.offsetHSL(0.05, 0, -0.1); // Shift hue slightly
    node.material.color.set(color);

    // Grow the node
    node.scale.multiplyScalar(1.2);

    // Adjust glow
    node.glowMesh.scale.copy(node.scale);
}

function resetNodeAppearance(node) {
    // Reset color
    node.material.color.setHex(0x00ff00);

    // Reset scale
    node.scale.copy(node.originalScale);

    // Reset glow
    node.glowMesh.scale.copy(node.originalScale);
}


function addSocialLinks() {
    const githubLink = document.getElementById('github-link');
    const linkedinLink = document.getElementById('linkedin-link');

    githubLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://github.com/Gabinson200', '_blank');
    });

    linkedinLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://www.linkedin.com/in/adam-kocsis-97b27624a/', '_blank');
    });
}
//calling socials
addSocialLinks();


function animate() {
    requestAnimationFrame(animate);

    particles.rotation.x += 0.0001;
    particles.rotation.y += 0.0001;

    // Smoothly interpolate current rotation to target rotation
    neuralNetworkGroup.rotation.x += (targetRotation.x - neuralNetworkGroup.rotation.x) * 0.05;
    neuralNetworkGroup.rotation.y += (targetRotation.y - neuralNetworkGroup.rotation.y) * 0.05;

    // Update hover effects
    nodes.forEach(node => {
        if (node !== hoveredNode) {
            node.scale.lerp(node.originalScale, 0.1);
            node.glowMesh.scale.lerp(node.originalScale, 0.1);
        }
    });

    // Rotate edges
    edges.forEach(edge => {
        edge.rotation.x = neuralNetworkGroup.rotation.x;
        edge.rotation.y = neuralNetworkGroup.rotation.y;
    });

    renderer.render(scene, camera);
}

function createParticle(x, y, speed) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    document.body.appendChild(particle);

    const size = Math.random() * 3 + 2;
    const angle = Math.random() * Math.PI * 0.9;
    const velocity = (Math.random() * speed / 110)+1.5;

    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.borderLeftWidth = size*0.5 + 'px';
    particle.style.borderRightWidth = size*0.5 + 'px';
    particle.style.borderBottomWidth = (size * (Math.random() * 2.5 + 3)) + 'px';

    const rotation = Math.atan2(Math.sin(angle), Math.cos(angle)) * (180 / Math.PI) + 90;
    particle.style.transform = `rotate(${rotation}deg)`;

    const animation = particle.animate([
        { 
            transform: `translate(${Math.cos(angle) * velocity * 5}px, ${Math.sin(angle) * velocity * 5}px) rotate(${rotation}deg)`,
            borderBottomColor: '#ffffa0',
            opacity: 1 
        },
        { 
            transform: `translate(${Math.cos(angle) * velocity * 15}px, ${Math.sin(angle) * velocity * 15}px) rotate(${rotation}deg)`,
            borderBottomColor: '#ffa500',
            opacity: 0.8
        },
        { 
            transform: `translate(${Math.cos(angle) * velocity * 30}px, ${Math.sin(angle) * velocity * 30}px) rotate(${rotation}deg)`,
            borderBottomColor: '#ff4500',
            opacity: 0 
        }
    ], {
        duration: 100 + Math.random() * 300,
        easing: 'ease-out'
    });

    animation.onfinish = () => {
        particle.remove();
    };

    cursorParticles.push(particle);
}

function addNeonText(scene, camera) {
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function(font) {
        const textGeometry = new THREE.TextGeometry('Adam Kocsis', {
            font: font,
            size: 0.5,
            height: 0.1,
            curveSegments: 15,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.018,
            bevelOffset: 0,
            bevelSegments: 5
        });

        textGeometry.computeBoundingBox();
        const centerOffset = - 0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);

        // Main text material (green)
        const textMaterial = new THREE.MeshPhongMaterial({
            color: 0x047e20,
            emissive: 0x00ff00,
            emissiveIntensity: 0.7,
            shininess: 5
        });

        // Outline material (white)
        const outlineMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.7,
            shininess: 90
        });

        // Main text mesh
        const mesh = new THREE.Mesh(textGeometry, textMaterial);
        mesh.position.set(centerOffset, 1.8, 0.20);

        // Outline mesh
        const outlineGeometry = new THREE.TextGeometry('Adam Kocsis', {
            font: font,
            size: 0.50, // Slightly larger
            height: 0.11, // Slightly thicker
            curveSegments: 15,
            bevelEnabled: true,
            bevelThickness: 0.015,
            bevelSize: 0.023,
            bevelOffset: 0,
            bevelSegments: 5
        });

        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outlineMesh.position.set(centerOffset, 1.8, 0.17); // Slightly behind the main text

        scene.add(outlineMesh);
        scene.add(mesh);

        // Add point lights
        const light = new THREE.PointLight(0x00ff00, 1, 10);
        light.position.set(0, 1, -2);
        scene.add(light);

        const light2 = new THREE.PointLight(0x00ff00, 1, 10);
        light2.position.set(0, -3, 6);
        scene.add(light2);

        // Add a white point light for the outline
        /*
        const whiteLight = new THREE.PointLight(0xffffff, 0.5, 20);
        whiteLight.position.set(0, 4, 1);
        scene.add(whiteLight);
        */
    });
}

function centerNeuralNetwork() {
    // Reset the rotation and position of the neural network group
    neuralNetworkGroup.rotation.set(0, 0, 0);
    neuralNetworkGroup.position.set(0, 0, 0);
    
    // Disable rotation based on mouse movement
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('click', onClick);

    document.getElementById('info-popup').style.display = 'none';

}
  
function startNodeColorAnimation() {
    // Start an animation loop
    nodeColorAnimationId = requestAnimationFrame(animateNodeColors);
}
  
function stopNodeColorAnimation() {
    // Stop the animation loop
    if (nodeColorAnimationId) {
        cancelAnimationFrame(nodeColorAnimationId);
        nodeColorAnimationId = null;
    }

    // Reset node colors
    nodes.forEach(node => {
      node.material.color.setHex(0x00ff00);
    });
}
  
function animateNodeColors() {
    nodes.forEach(node => {
      // Generate a random color
      const r = Math.sin(Date.now() * 0.001 + node.position.x) * 0.5 + 0.5;
      const g = Math.sin(Date.now() * 0.002 + node.position.y) * 0.5 + 0.5;
      const b = Math.sin(Date.now() * 0.003 + node.position.z) * 0.5 + 0.5;
      node.material.color.setRGB(r, g, b);
    });
    
    nodeColorAnimationId = requestAnimationFrame(animateNodeColors);
}


function enableOtherFunctionality() {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
}


setInterval(() => {
    cursorParticles = cursorParticles.filter(p => document.body.contains(p));
}, 10000);


init();
