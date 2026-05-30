import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- НАСТРОЙКИ И СОСТОЯНИЕ ---
const playerStats = { health: 100, battery: 100, stamina: 100, fatigue: 0 };
const CELL_SIZE = 5;
const MAZE_SIZE = 12;
let isDead = false;
let canShoot = true;

// Скорости
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let move = { f: false, b: false, l: false, r: false, shift: false };

// --- 1. ИНИЦИАЛИЗАЦИЯ THREE.JS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.15);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(CELL_SIZE * 1.5, 1.7, CELL_SIZE * 1.5); // Стартовая позиция игрока

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Свечение (Фонарик)
const flashLight = new THREE.SpotLight(0xfff5e6, 5, 25, Math.PI / 5, 0.6, 2);
flashLight.position.set(0, 0, 0);
flashLight.target.position.set(0, 0, -1);
camera.add(flashLight);
camera.add(flashLight.target);

// Вспышка оружия
const muzzleFlash = new THREE.PointLight(0xffaa00, 0, 8);
muzzleFlash.position.set(0.2, -0.2, -0.4);
camera.add(muzzleFlash);
scene.add(camera);

// --- 2. СИСТЕМА УПРАВЛЕНИЯ (ФИКС КЛИКА) ---
const controls = new PointerLockControls(camera, document.body);
const menuElement = document.getElementById('menu');

menuElement.addEventListener('click', () => {
    if (!isDead) controls.lock();
});

controls.addEventListener('lock', () => { menuElement.style.display = 'none'; });
controls.addEventListener('unlock', () => { if (!isDead) menuElement.style.display = 'flex'; });

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') move.f = true;
    if (e.code === 'KeyS') move.b = true;
    if (e.code === 'KeyA') move.l = true;
    if (e.code === 'KeyD') move.r = true;
    if (e.code === 'ShiftLeft') move.shift = true;
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') move.f = false;
    if (e.code === 'KeyS') move.b = false;
    if (e.code === 'KeyA') move.l = false;
    if (e.code === 'KeyD') move.r = false;
    if (e.code === 'ShiftLeft') move.shift = false;
});

// --- 3. ГЕНЕРАЦИЯ СЦЕНЫ И СТЕН ---
const wallMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });

const floorGeo = new THREE.PlaneGeometry(200, 200);
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Строим стены вокруг арены
const wallGeo = new THREE.BoxGeometry(CELL_SIZE, 4, CELL_SIZE);
for (let i = 0; i < MAZE_SIZE; i++) {
    for (let j = 0; j < MAZE_SIZE; j++) {
        if (i === 0  i === MAZE_SIZE - 1  j === 0 || j === MAZE_SIZE - 1) {
            let wall = new THREE.Mesh(wallGeo, wallMat);
            wall.position.set(i * CELL_SIZE, 2, j * CELL_SIZE);
            scene.add(wall);
        }
    }
}

// --- 4. СОЗДАНИЕ РОБОТА-ЗАЙЦА (NOSEY) ---
const noseyGroup = new THREE.Group();
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.7, roughness: 0.4 });

// Тело и голова
const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), darkMetal); body.position.y = 0.8;
const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMetal); head.position.y = 1.85;
noseyGroup.add(body, head);

// Глаза (Красные сферы)
const eyeGeo = new THREE.SphereGeometry(0.07);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(-0.13, 1.9, 0.26);
const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(0.13, 1.9, 0.26);
noseyGroup.add(leftEye, rightEye);

// Длинные уши робота
const earGeo = new THREE.BoxGeometry(0.08, 0.7, 0.15);
const lEar = new THREE.Mesh(earGeo, darkMetal); lEar.position.set(-0.15, 2.35, 0); lEar.
rotation.z = -0.15;
const rEar = new THREE.Mesh(earGeo, darkMetal); rEar.position.set(0.15, 2.35, 0); rEar.rotation.z = 0.15;
noseyGroup.add(lEar, rEar);

// Спавн Ноузи в углу карты
noseyGroup.position.set((MAZE_SIZE - 3) * CELL_SIZE, 0, (MAZE_SIZE - 3) * CELL_SIZE);
scene.add(noseyGroup);

// --- 5. СИСТЕМА СТРЕЛЬБЫ ---
const raycaster = new THREE.Raycaster();

document.addEventListener('mousedown', (e) => {
    if (e.button !== 0  !controls.isLocked  !canShoot || isDead) return;
    
    canShoot = false;
    
    // Расчет разброса пуль на основе усталости
    let spreadAmount = 0.005;
    if (playerStats.fatigue > 80) spreadAmount = 0.12;
    else if (playerStats.fatigue > 40) spreadAmount = 0.04;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.x += (Math.random() - 0.5) * spreadAmount;
    dir.y += (Math.random() - 0.5) * spreadAmount;
    dir.z += (Math.random() - 0.5) * spreadAmount;
    dir.normalize();

    raycaster.set(camera.position, dir);
    
    // Звук выстрела (безопасное воспроизведение)
    const sShoot = document.getElementById('snd-shoot');
    if(sShoot.src) { sShoot.currentTime = 0; sShoot.play().catch(()=>{}); }
    
    // Эффекты выстрела и отдача камеры
    muzzleFlash.intensity = 8;
    document.getElementById('flash-screen').style.background = 'rgba(255, 180, 50, 0.25)';
    camera.rotation.x += 0.04;
    
    setTimeout(() => { 
        muzzleFlash.intensity = 0; 
        document.getElementById('flash-screen').style.background = 'transparent';
        camera.rotation.x -= 0.04;
        canShoot = true; 
    }, 200);

    // Проверка попадания в Ноузи
    const intersects = raycaster.intersectObject(noseyGroup, true);
    if (intersects.length > 0) {
        const sHit = document.getElementById('snd-hit');
        if(sHit.src) { sHit.currentTime = 0; sHit.play().catch(()=>{}); }
        
        // Отталкиваем робота назад при попадании
        noseyGroup.translateZ(-1.2);
    }
});

// --- 6. ИГРОВОЙ ЦИКЛ (ОБНОВЛЕНИЕ КАДРОВ) ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    if (controls.isLocked && !isDead) {
        // Логика движения игрока
        const isWalking = move.f  move.b  move.l || move.r;
        const isRunning = isWalking && move.shift && playerStats.stamina > 5;
        let speed = isRunning ? 9.0 : 4.5;

        // Физика замедления
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        
        direction.z = Number(move.f) - Number(move.b);
        direction.x = Number(move.r) - Number(move.l);
        direction.normalize();

        if (isWalking) {
            velocity.z -= direction.z * speed * delta;
            velocity.x -= direction.x * speed * delta;
        }

        controls.moveRight(-velocity.x);
        controls.moveForward(-velocity.z);

        // Управление характеристиками (Стамина и усталость)
        if (isRunning) {
            playerStats.stamina = Math.max(0, playerStats.stamina - 45 * delta);
            playerStats.fatigue = Math.min(100, playerStats.fatigue + 15 * delta);
        } else {
            playerStats.stamina = Math.min(100, playerStats.stamina + 20 * delta);
            if (!isWalking) playerStats.fatigue = Math.max(0, playerStats.fatigue - 8 * delta);
        }

        // Обновление шкал на экране
        document.getElementById('stamina-bar').style.width = playerStats.stamina + '%';
        document.getElementById('fatigue-val').innerText = Math.round(playerStats.fatigue) + '%';

        // ИИ Nosey: Постоянная слежка и преследование игрока
        noseyGroup.lookAt(camera.position.x, 0, camera.position.z);
        // Медленно шагает за игроком
        noseyGroup.translateZ(2.2 * delta);

        // Если Nosey подошел вплотную — урон игроку
        if (noseyGroup.position.distanceTo(camera.position) < 1.6) {
            playerStats.health = Math.max(0, playerStats.health - 60 * delta);
         document.getElementById('health-bar').style.width = playerStats.health + '%';

            if (playerStats.health <= 0) {
                isDead = true;
                controls.unlock();
                document.getElementById('menu').innerHTML = '<h1 class="glitch" style="color:red; font-size:45px;">ПРОТОКОЛ СОРВАН</h1><p style="color:#666; margin-top:10px;">Объект Nosey ликвидировал угрозу. Перезагрузите систему (F5).</p>';
            }
        }
    }

    renderer.render(scene, camera);
}

// Запуск основного цикла
animate();

// Корректное масштабирование при изменении размеров экрана ноутбука
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});   