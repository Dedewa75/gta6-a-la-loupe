// Communauté : comptes (Google / e-mail), salons de chat, forum, signalements, modération.
// Chargé seulement si firebase-config.js est rempli.
const V = "10.12.2";
const B = `https://www.gstatic.com/firebasejs/${V}`;
const { initializeApp } = await import(`${B}/firebase-app.js`);
const A = await import(`${B}/firebase-auth.js`);
const F = await import(`${B}/firebase-firestore.js`);

let app, auth, db;
export let utilisateur = null;   // compte Firebase
export let profil = null;        // { pseudo, ... } dans Firestore
export let admin = false;

export const SALONS = [
  { id: "general", nom: "général", desc: "Discussion libre sur GTA 6" },
  { id: "argent", nom: "argent-et-planques", desc: "Planques, astuces pour gagner de l'argent" },
  { id: "armes", nom: "armes", desc: "Armes cachées, meilleures armes, améliorations" },
  { id: "vehicules", nom: "vehicules", desc: "Voitures rares, garages, courses" },
  { id: "secrets", nom: "secrets-et-easter-eggs", desc: "Mystères, easter eggs, détails cachés" },
  { id: "aide", nom: "entraide-missions", desc: "Bloqué sur une mission ? Demande ici" },
];
export const CATS_FORUM = { general: "Général", guides: "Guides", questions: "Questions", secrets: "Secrets", bugs: "Bugs" };

// ---------- filtre de langage (bloque l'envoi) ----------
const INTERDITS = ["connard","connasse","pute","putain de ta","salope","encule","enculé","ntm","nique ta","niquer ta","fdp","fils de p","batard","bâtard","pd ","pédé","negre","nègre","bougnoul","youpin","tapette","sale arabe","sale noir","nigger","nigga","faggot","kys","suicide toi","cunt","whore","slut"];
const normal = (t) => " " + String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ") + " ";
const MOTS = INTERDITS.map((m) => normal(m).trim());
export function langageOk(t) {
  const s = normal(t), colle = s.replace(/ /g, "");
  return !MOTS.some((m) => s.includes(" " + m + " ") || (m.length >= 6 && colle.includes(m.replace(/ /g, ""))));
}
// liens interdits (anti-arnaque) sauf YouTube / TikTok / Instagram
const LIEN = /https?:\/\/(?!(www\.)?(youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|instagram\.com|dedewa75\.github\.io)\b)\S+/i;
export const lienOk = (t) => !LIEN.test(t);

let dernierEnvoi = 0;
function antiSpam() {
  const maintenant = Date.now();
  if (maintenant - dernierEnvoi < 3000) throw new Error("Doucement : attends 3 secondes entre deux messages.");
  dernierEnvoi = maintenant;
}
function verifierTexte(t, max) {
  t = (t || "").trim();
  if (!t) throw new Error("Message vide.");
  if (t.length > max) throw new Error(`Trop long (${max} caractères maximum).`);
  if (!langageOk(t)) throw new Error("Message refusé : langage interdit (insultes, propos haineux).");
  if (!lienOk(t)) throw new Error("Les liens sont interdits, sauf YouTube, TikTok et Instagram.");
  return t;
}

// ---------- démarrage ----------
export async function demarrer(config, quandChange) {
  app = initializeApp(config);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
  try { await A.getRedirectResult(auth); } catch {}
  A.onAuthStateChanged(auth, async (u) => {
    utilisateur = u; profil = null; admin = false;
    if (u) {
      const p = await F.getDoc(F.doc(db, "utilisateurs", u.uid)).catch(() => null);
      profil = p?.exists() ? p.data() : null;
      admin = !!(await F.getDoc(F.doc(db, "admins", u.uid)).catch(() => null))?.exists();
    }
    quandChange();
  });
}
export const emailVerifie = () => !!utilisateur && (utilisateur.emailVerified || utilisateur.providerData.some((p) => p.providerId === "google.com"));
export const peutEcrire = () => emailVerifie() && !!profil && !profil.banni;

// ---------- comptes ----------
export async function connexionGoogle() {
  const fournisseur = new A.GoogleAuthProvider();
  try { await A.signInWithPopup(auth, fournisseur); }
  catch (e) { if (/popup/i.test(e.code || "")) await A.signInWithRedirect(auth, fournisseur); else throw e; }
}
export const connexionEmail = (email, mdp) => A.signInWithEmailAndPassword(auth, email, mdp);
export async function inscriptionEmail(email, mdp) {
  const r = await A.createUserWithEmailAndPassword(auth, email, mdp);
  await A.sendEmailVerification(r.user);
}
export const renvoyerVerification = () => A.sendEmailVerification(auth.currentUser);
export const motDePasseOublie = (email) => A.sendPasswordResetEmail(auth, email);
export async function verifierEncore() { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); utilisateur = auth.currentUser; }
export const deconnexion = () => A.signOut(auth);

export async function creerProfil(pseudo) {
  pseudo = pseudo.trim();
  if (!/^[A-Za-z0-9_\-.]{3,20}$/.test(pseudo)) throw new Error("Pseudo : 3 à 20 caractères (lettres, chiffres, _ - .).");
  if (!langageOk(pseudo)) throw new Error("Ce pseudo n'est pas autorisé.");
  const cle = pseudo.toLowerCase();
  const ref = F.doc(db, "pseudos", cle);
  if ((await F.getDoc(ref)).exists()) throw new Error("Ce pseudo est déjà pris.");
  const lot = F.writeBatch(db);
  lot.set(ref, { uid: utilisateur.uid });
  lot.set(F.doc(db, "utilisateurs", utilisateur.uid), { pseudo, age16: true, cree: F.serverTimestamp() });
  await lot.commit();
  profil = { pseudo, age16: true };
}

// ---------- salons ----------
export function ecouterSalon(id, cb) {
  const q = F.query(F.collection(db, "salons", id, "messages"), F.orderBy("date", "desc"), F.limit(80));
  return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()), (e) => cb(null, e));
}
export async function envoyer(salon, texte) {
  texte = verifierTexte(texte, 500); antiSpam();
  await F.addDoc(F.collection(db, "salons", salon, "messages"), { auteur: utilisateur.uid, pseudo: profil.pseudo, texte, date: F.serverTimestamp() });
}
export const supprimerMessage = (salon, id) => F.deleteDoc(F.doc(db, "salons", salon, "messages", id));

// ---------- forum ----------
export function ecouterSujets(cb) {
  const q = F.query(F.collection(db, "sujets"), F.orderBy("derniere", "desc"), F.limit(60));
  return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => cb(null, e));
}
export async function creerSujet(titre, texte, categorie) {
  titre = verifierTexte(titre, 100); texte = verifierTexte(texte, 3000); antiSpam();
  if (!CATS_FORUM[categorie]) categorie = "general";
  const r = await F.addDoc(F.collection(db, "sujets"), { titre, texte, categorie, auteur: utilisateur.uid, pseudo: profil.pseudo, date: F.serverTimestamp(), derniere: F.serverTimestamp(), nbReponses: 0 });
  return r.id;
}
export function ecouterSujet(id, cb) {
  const arr1 = F.onSnapshot(F.doc(db, "sujets", id), (d) => cb({ sujet: d.exists() ? { id: d.id, ...d.data() } : null }));
  const arr2 = F.onSnapshot(F.query(F.collection(db, "sujets", id, "reponses"), F.orderBy("date", "asc"), F.limit(200)), (s) => cb({ reponses: s.docs.map((d) => ({ id: d.id, ...d.data() })) }));
  return () => { arr1(); arr2(); };
}
export async function repondre(sujetId, texte) {
  texte = verifierTexte(texte, 2000); antiSpam();
  const lot = F.writeBatch(db);
  lot.set(F.doc(F.collection(db, "sujets", sujetId, "reponses")), { texte, auteur: utilisateur.uid, pseudo: profil.pseudo, date: F.serverTimestamp() });
  lot.update(F.doc(db, "sujets", sujetId), { nbReponses: F.increment(1), derniere: F.serverTimestamp() });
  await lot.commit();
}
export const supprimerSujet = (id) => F.deleteDoc(F.doc(db, "sujets", id));
export const supprimerReponse = (sujetId, id) => F.deleteDoc(F.doc(db, "sujets", sujetId, "reponses", id));

// ---------- signalements & modération ----------
export async function signaler(chemin, texte, auteurSignale, pseudoSignale) {
  await F.addDoc(F.collection(db, "signalements"), { chemin, texte: String(texte).slice(0, 500), auteurSignale, pseudoSignale, par: utilisateur.uid, date: F.serverTimestamp() });
}
export function ecouterSignalements(cb) {
  return F.onSnapshot(F.query(F.collection(db, "signalements"), F.orderBy("date", "desc"), F.limit(50)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}
export const supprimerChemin = (chemin) => F.deleteDoc(F.doc(db, ...chemin.split("/")));
export const fermerSignalement = (id) => F.deleteDoc(F.doc(db, "signalements", id));
export const bannir = (uid) => F.updateDoc(F.doc(db, "utilisateurs", uid), { banni: true });
