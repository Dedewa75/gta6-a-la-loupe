// GTA VI à la loupe — scène 3D de fond (Leonida en hologramme rayon X)
// Three.js est chargé depuis un CDN. Si la 3D ne marche pas (vieux téléphone), le site reste utilisable sans.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 760px)").matches || navigator.maxTouchPoints > 0;

const canvas = document.getElementById("fond3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.055);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

// ---------- l'île : un nuage de points avec du relief ----------
const LARG = 10, PROF = 12.5, HAUT = 1.25;
const img = await new Promise((ok, ko) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = ko;
  i.src = "images/leonida-relief.png";
});
const cv = document.createElement("canvas");
cv.width = img.width; cv.height = img.height;
const cx = cv.getContext("2d", { willReadFrequently: true });
cx.drawImage(img, 0, 0);
const px = cx.getImageData(0, 0, img.width, img.height).data;

const pos = [], haut = [], urb = [], alea = [];
const parPixel = mobile ? 1 : 2;
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    const k = (y * img.width + x) * 4;
    if (px[k + 2] < 128) continue; // eau
    const h = px[k] / 255, u = px[k + 1] / 255;
    for (let n = 0; n < parPixel; n++) {
      const jx = (Math.random() - 0.5) / img.width, jy = (Math.random() - 0.5) / img.height;
      pos.push(((x / img.width) + jx - 0.5) * LARG, h * HAUT + u * 0.08, ((y / img.height) + jy - 0.5) * PROF);
      haut.push(h); urb.push(u); alea.push(Math.random());
    }
  }
}
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute("aH", new THREE.Float32BufferAttribute(haut, 1));
geo.setAttribute("aU", new THREE.Float32BufferAttribute(urb, 1));
geo.setAttribute("aR", new THREE.Float32BufferAttribute(alea, 1));

const uniforms = {
  uTemps: { value: 0 },
  uScan: { value: -PROF / 2 },
  uPix: { value: renderer.getPixelRatio() },
  uTaille: { value: mobile ? 2.2 : 1.7 },
  uOpacite: { value: 1 },
};
const ile = new THREE.Points(geo, new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute float aH; attribute float aU; attribute float aR;
    uniform float uTemps, uScan, uPix, uTaille;
    varying float vH; varying float vU; varying float vScan; varying float vR;
    void main(){
      vec3 p = position;
      p.y += sin(uTemps*1.4 + aR*6.28) * 0.012;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      gl_Position = projectionMatrix * mv;
      vScan = smoothstep(0.55, 0.0, abs(position.z - uScan));
      gl_PointSize = (uTaille + aH*1.6 + vScan*2.5) * uPix * (9.0 / -mv.z);
      vH = aH; vU = aU; vR = aR;
    }`,
  fragmentShader: /* glsl */`
    uniform float uOpacite;
    varying float vH; varying float vU; varying float vScan; varying float vR;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float doux = smoothstep(0.5, 0.0, d);
      vec3 bleu = vec3(0.0, 0.33, 0.5), cyan = vec3(0.3, 0.85, 1.0), blanc = vec3(0.9, 0.98, 1.0), rose = vec3(1.0, 0.18, 0.66);
      vec3 c = mix(bleu, cyan, vH);
      c = mix(c, blanc, vU*0.7);
      c += blanc * vScan * 0.9;
      c = mix(c, rose, step(0.985, vR) * 0.8);
      gl_FragColor = vec4(c, doux * (0.35 + vH*0.45 + vScan*0.5) * uOpacite);
    }`,
}));
scene.add(ile);

// ---------- l'eau : grille holographique ----------
const grille = new THREE.GridHelper(60, 60, 0x007ba7, 0x0a2a3d);
grille.material.transparent = true;
grille.material.opacity = 0.35;
grille.position.y = -0.02;
scene.add(grille);

// ---------- balises roses sur les comtés ----------
const COMTES = { lummox: [51, 12.5], leonard: [70, 29], kelly: [36, 33], "vice-dale": [73, 53], mariana: [39, 73] };
const balises = {};
const rond = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,45,168,1)"); r.addColorStop(1, "rgba(255,45,168,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
for (const [id, [x, y]] of Object.entries(COMTES)) {
  const bx = (x / 100 - 0.5) * LARG, bz = (y / 100 - 0.5) * PROF;
  const groupe = new THREE.Group();
  const ligne = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.2, 0)]),
    new THREE.LineBasicMaterial({ color: 0xff2da8, transparent: true, opacity: 0.6 })
  );
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: rond, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 2.2; halo.scale.setScalar(0.55);
  groupe.add(ligne, halo);
  groupe.position.set(bx, 0.6, bz);
  scene.add(groupe);
  balises[id] = { groupe, halo };
}

// ---------- poussière / particules dans l'air ----------
const nbP = mobile ? 250 : 600, pp = [];
for (let i = 0; i < nbP; i++) pp.push((Math.random() - 0.5) * 30, Math.random() * 8, (Math.random() - 0.5) * 30);
const poussiere = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pp, 3)),
  new THREE.PointsMaterial({ color: 0x4fd3ff, size: 0.04, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
);
scene.add(poussiere);

// ---------- poses de caméra (une par onglet) ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POSES = {
  accueil:   { pos: V(0, 6.5, 12.5), cible: V(0, 1.6, 0),  tourne: true },
  tout:      { pos: V(-6, 5, 9),    cible: V(0, 0.3, 0) },
  actus:     { pos: V(7, 4.5, 8),   cible: V(1, 0.3, 0) },
  videos:    { pos: V(-8, 3.2, 6),  cible: V(0.5, 0.4, 0) },
  secrets:   { pos: V(-3, 1.6, 5),  cible: V(-0.5, 0.6, -1) },
  astuces:   { pos: V(5, 3, -7),    cible: V(0, 0.4, 0) },
  vehicules: { pos: V(8, 1.4, 3),   cible: V(2, 0.4, 0.5) },
  armes:     { pos: V(-7, 2.2, -2), cible: V(-1, 0.5, 0) },
  argent:    { pos: V(4.5, 2.5, 4), cible: V(2.2, 0.3, 0.6) },
  lieux:     { pos: V(-2, 9, 6),    cible: V(0, 0, 0.5) },
  carte:     { pos: V(0, 15, 0.01), cible: V(0, 0, 0) },
};
let poseOnglet = POSES.tout, focus = null;
const camPos = POSES.accueil.pos.clone(), camCible = POSES.accueil.cible.clone();
camera.position.copy(camPos);

// API utilisée par le site
window.scene3d = {
  onglet(nom) { poseOnglet = POSES[nom] || POSES.tout; focus = null; },
  comte(id) {
    const b = balises[id];
    if (!b) return;
    const p = b.groupe.position;
    focus = { pos: V(p.x + 1.5, 4.5, p.z + 4), cible: V(p.x, 0.5, p.z) };
  },
};

// ---------- interactions ----------
const souris = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { souris.x = e.clientX / innerWidth - 0.5; souris.y = e.clientY / innerHeight - 0.5; }, { passive: true });

function taille() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50; // plus large en portrait (téléphone)
  camera.updateProjectionMatrix();
}
addEventListener("resize", taille);
taille();

// ---------- boucle d'animation ----------
const horloge = new THREE.Clock();
let actif = true;
document.addEventListener("visibilitychange", () => { actif = !document.hidden; if (actif) horloge.getDelta(); });

function boucle() {
  requestAnimationFrame(boucle);
  if (!actif) return;
  const dt = Math.min(horloge.getDelta(), 0.05), t = horloge.elapsedTime;
  uniforms.uTemps.value = t;
  uniforms.uScan.value = ((t * 2.2) % (PROF + 4)) - PROF / 2 - 2;

  // défilement : de la vue « accueil » à la vue de l'onglet
  const p = Math.min(1, scrollY / (innerHeight * 0.85));
  uniforms.uOpacite.value = 1 - p * 0.45; // plus discret derrière le texte
  const cible = focus || poseOnglet;
  const pos = POSES.accueil.pos.clone().lerp(cible.pos, p);
  const regard = POSES.accueil.cible.clone().lerp(cible.cible, p);
  if (!reduit && p < 0.99) pos.applyAxisAngle(V(0, 1, 0), t * 0.08 * (1 - p)); // l'île tourne doucement sur l'accueil
  if (!reduit) { pos.x += souris.x * 0.8; pos.y -= souris.y * 0.5; }

  const k = 1 - Math.pow(0.0025, dt); // lissage indépendant du nombre d'images par seconde
  camPos.lerp(pos, k); camCible.lerp(regard, k);
  camera.position.copy(camPos);
  camera.lookAt(camCible);

  for (const b of Object.values(balises)) b.halo.scale.setScalar(0.5 + Math.sin(t * 3) * 0.08);
  poussiere.rotation.y = t * 0.01;
  renderer.render(scene, camera);
}
boucle();
document.documentElement.classList.add("avec3d");
