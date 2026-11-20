// GTA VI à la loupe — l'appli : même contenu que le site, interface d'application + communauté
import { FIREBASE } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const urlOk = (u) => (/^https?:\/\//i.test(u) ? esc(u) : "#");
const dollars = (n) => (typeof n === "number" ? "$" + n.toLocaleString("fr-BE") : null);
const dateCourte = (d) => (d ? new Date(d).toLocaleDateString("fr-BE", { day: "numeric", month: "short" }) : "");
const heure = (t) => { const d = t?.toDate ? t.toDate() : t ? new Date(t) : null; if (!d) return "à l'instant"; const auj = new Date().toDateString() === d.toDateString(); return auj ? d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }); };
const couleur = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 45%)`; };
const initiale = (p) => esc(String(p || "?").charAt(0).toUpperCase());

// ---------- données (les mêmes que le site) ----------
const D = { actus: [], armes: [], vehicules: [], videos: [] };
const frais = (f) => fetch(`../data/${f}.json?v=${Date.now()}`).then((r) => r.json()).catch(() => ({}));
const pret = Promise.all([frais("contenu"), frais("armes"), frais("vehicules"), frais("videos")]).then(([c, a, v, vid]) => {
  D.actus = (c.entrees || []).filter((e) => e.statut === "confirme").sort((x, y) => y.date.localeCompare(x.date));
  D.armes = (a.armes || []).filter((x) => x.statut === "confirme");
  D.vehicules = (v.vehicules || []).filter((x) => x.statut === "confirme");
  D.videos = (vid.videos || []).sort((x, y) => y.date.localeCompare(x.date));
  D.maj = c.derniereMaj;
});

const CAT_ACTU = { actus: ["📰", "Actu"], secrets: ["🥚", "Secret"], astuces: ["💡", "Astuce"], argent: ["💰", "Argent"], lieux: ["📍", "Lieu"], vehicules: ["🚗", "Véhicule"], armes: ["🔫", "Arme"] };
const CLASSES_A = { pistolets: "Pistolets", revolvers: "Revolvers", mitraillettes: "Mitraillettes", "fusils-a-pompe": "Fusils à pompe", "fusils-assaut": "Fusils d'assaut", "fusils-tactiques": "Fusils tactiques", snipers: "Snipers", lourdes: "Armes lourdes", melee: "Mêlée", explosifs: "Explosifs" };
const CLASSES_V = { supercars: "Supercars", sportives: "Sportives", muscle: "Muscle", coupes: "Coupés", berlines: "Berlines", suv: "SUV", pickups: "Pick-up", "tout-terrain": "Tout-terrain", utilitaires: "Utilitaires", motos: "Motos" };
const CATS_VIDEO = { argent: "💰 Argent caché", armes: "🔫 Armes cachées", secrets: "🥚 Secrets", vehicules: "🚗 Véhicules rares", astuces: "💡 Astuces" };
const ZONES = { lummox: ["Lummox County", 51, 12.5], leonard: ["Leonard County", 70, 29], kelly: ["Kelly County", 36, 33], "vice-dale": ["Vice-Dale County", 73, 53], mariana: ["Mariana County", 39, 73] };

// ---------- communauté (chargée seulement si Firebase est configuré) ----------
let C = null;
if (FIREBASE) {
  try { C = await import("./communaute.js"); await C.demarrer(FIREBASE, () => { majAvatar(); rafraichir(); }); }
  catch (e) { console.error("Communauté indisponible", e); C = null; }
}
function majAvatar() {
  const a = $("avatarHaut");
  if (C?.profil) { a.textContent = C.profil.pseudo[0].toUpperCase(); a.style.background = couleur(C.utilisateur.uid); }
  else { a.textContent = "?"; a.style.background = ""; }
}

// ---------- navigation ----------
const etat = { infos: "actus", comm: "salons", q: "", classeA: "", classeV: "" };
let arreter = null; // coupe l'écoute temps réel de l'écran précédent
let profondeurPrec = 0;
function route() {
  const [nom, param] = (location.hash.slice(1) || "accueil").split("/");
  return { nom, param: param ? decodeURIComponent(param) : null };
}
const aller = (h) => { location.hash = h; };
addEventListener("hashchange", rafraichir);

const TITRES = { accueil: "GTA VI <b>à la loupe</b>", infos: "Infos", communaute: "Communauté", profil: "Profil", salon: "", sujet: "Forum", connexion: "Connexion" };
async function rafraichir() {
  await pret;
  fermerFeuille();
  if (arreter) { arreter(); arreter = null; }
  const { nom, param } = route();
  const profond = ["salon", "sujet"].includes(nom) ? 1 : 0;
  const ecran = $("ecran");
  ecran.className = profond < profondeurPrec ? "entreRetour" : "entre";
  profondeurPrec = profond;
  $("retour").hidden = !profond;
  $("titreApp").innerHTML = TITRES[nom] ?? TITRES.accueil;
  document.querySelectorAll(".onglets button").forEach((b) => b.classList.toggle("actif", b.dataset.aller === (profond ? "communaute" : nom)));
  (ECRANS[nom] || ECRANS.accueil)(ecran, param);
}

// ---------- briques ----------
const ligne = (ico, classeIco, titre, sous, droite, attrs) =>
  `<button class="ligneL" ${attrs}><span class="ico ${classeIco}">${ico}</span><span class="txt"><b>${titre}</b><span>${sous}</span></span><span class="droite">${droite}</span><span class="chevron">›</span></button>`;
const stat = (nom, v) => `<div class="stat"><span>${nom}</span><div class="jauge"><i style="width:${typeof v === "number" ? Math.min(v, 10) * 10 : 0}%"></i></div><b>${typeof v === "number" ? v.toFixed(1) : "?"}</b></div>`;
const sources = (l) => `<div class="sources">Sources : ${(l || []).map((s) => `<a href="${urlOk(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.nom)} ↗</a>`).join("")}</div>`;
const segments = (liste, actif, attr) => `<div class="segments">${Object.entries(liste).map(([k, v]) => `<button class="${k === actif ? "actif" : ""}" ${attr}="${k}">${v}</button>`).join("")}</div>`;
const plat = (v) => v.plateforme || "youtube";
const vignette = (v) => `<button class="vignette" data-video="${esc(plat(v) + ":" + v.id)}"><div class="img ${plat(v)}" ${plat(v) === "youtube" ? `style="background-image:url(https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg)"` : ""}></div><p>${esc(v.titre)}</p></button>`;

// ---------- écrans ----------
const ECRANS = {
  accueil(e) {
    const pseudo = C?.profil?.pseudo;
    e.innerHTML = `
      <div class="bienvenue"><small>Leonida · infos vérifiées</small><h1>${pseudo ? `Salut ${esc(pseudo)} 👋` : "Bienvenue à Leonida"}</h1>
        <p>${D.armes.length} armes, ${D.vehicules.length} véhicules, ${D.videos.length} vidéos. Dernière vérification : ${dateCourte(D.maj)}</p></div>
      ${installee() ? "" : `<button class="btn" data-action="feuilleInstaller" style="margin-top:-4px">📲 Installer l'appli sur mon téléphone</button>`}
      <h2 class="sec">Explorer</h2>
      <div class="tuiles">
        <button class="tuile" data-infos="armes"><i>🔫</i>Armes</button>
        <button class="tuile" data-infos="vehicules"><i>🚗</i>Véhicules</button>
        <button class="tuile" data-infos="videos"><i>🎬</i>Vidéos</button>
        <button class="tuile" data-infos="carte"><i>🗺️</i>Carte</button>
      </div>
      <h2 class="sec">Dernières infos <button data-infos="actus">Tout voir</button></h2>
      <div class="liste">${D.actus.slice(0, 4).map(ligneActu).join("") || '<div class="vide">Rien pour l\'instant.</div>'}</div>
      <h2 class="sec">Nouvelles vidéos <button data-infos="videos">Tout voir</button></h2>
      <div class="defile">${D.videos.slice(0, 10).map(vignette).join("")}</div>
      <h2 class="sec">Communauté <button data-aller="communaute">Ouvrir</button></h2>
      <div class="liste">${(C ? C.SALONS.slice(0, 3) : SALONS_DEMO).map((s) => ligne("#", "", esc(s.nom), esc(s.desc), "", `data-salon="${s.id}"`)).join("")}</div>`;
  },

  infos(e) {
    const t = etat.infos;
    let corps = "";
    const q = etat.q.toLowerCase(), cherche = (s) => !q || s.toLowerCase().includes(q);
    if (t === "actus") corps = `<div class="liste">${D.actus.filter((x) => cherche(x.titre + x.resume)).map(ligneActu).join("") || '<div class="vide">Aucune info.</div>'}</div>`;
    if (t === "armes") {
      const l = D.armes.filter((x) => (!etat.classeA || x.classe === etat.classeA) && cherche(x.nom));
      corps = segments({ "": "Toutes", ...CLASSES_A }, etat.classeA, "data-classe-a") +
        `<div class="liste">${l.map((a) => ligne("🔫", "rose", esc(a.nom), esc(CLASSES_A[a.classe] || ""), `<b>${dollars(a.prix) || "?"}</b>${typeof a.degats === "number" ? "Dégâts " + a.degats : ""}`, `data-arme="${esc(a.nom)}"`)).join("") || '<div class="vide">Aucune arme.</div>'}</div>`;
    }
    if (t === "vehicules") {
      const l = D.vehicules.filter((x) => (!etat.classeV || x.classe === etat.classeV) && cherche(x.nom)).sort((a, b) => (b.vitesse ?? 0) - (a.vitesse ?? 0));
      corps = segments({ "": "Tous", ...CLASSES_V }, etat.classeV, "data-classe-v") +
        `<div class="liste">${l.map((v) => ligne("🚗", "bleu", esc(v.nom), esc(CLASSES_V[v.classe] || ""), `<b>${v.vitesse ?? "?"}</b>vitesse`, `data-veh="${esc(v.nom)}"`)).join("") || '<div class="vide">Aucun véhicule.</div>'}</div>`;
    }
    if (t === "videos") {
      const l = D.videos.filter((v) => cherche(v.titre + (v.chaine || "")));
      corps = `<div class="liste">${l.map((v) => ligne(plat(v) === "tiktok" ? "♪" : plat(v) === "instagram" ? "◎" : "▶", "rose", esc(v.titre), esc((CATS_VIDEO[v.categorie] || "") + (v.chaine ? " · " + v.chaine : "")), "", `data-video="${esc(plat(v) + ":" + v.id)}"`)).join("")}</div>`;
    }
    if (t === "carte") {
      const parZone = {}; D.actus.forEach((x) => x.zone && (parZone[x.zone] = (parZone[x.zone] || 0) + 1));
      corps = `<div class="rx"><img src="../images/carte-leonida-rayonx.jpg" alt="Carte de Leonida">${Object.entries(ZONES).map(([id, [n, x, y]]) => `<button class="pin ${parZone[id] ? "" : "vide"}" style="left:${x}%;top:${y}%" data-zone="${id}"><i>${parZone[id] || 0}</i>${esc(n.toUpperCase())}</button>`).join("")}</div>
        <p class="vide">Touche un comté pour voir les infos confirmées trouvées sur place.</p>`;
    }
    e.innerHTML = segments({ actus: "📰 Actus", armes: "🔫 Armes", vehicules: "🚗 Véhicules", videos: "🎬 Vidéos", carte: "🗺️ Carte" }, t, "data-infos") +
      (t === "carte" ? "" : `<input class="recherche" id="q" type="search" placeholder="Rechercher…" value="${esc(etat.q)}">`) + corps;
  },

  communaute(e) {
    if (!C) return ecranBientot(e);
    const t = etat.comm;
    const bandeau = !C.utilisateur ? `<div class="bienvenue"><small>Communauté</small><h1>Rejoins les joueurs</h1><p>Connecte-toi avec Google ou ton e-mail pour discuter dans les salons et le forum.</p><button class="btn" data-aller="profil">Se connecter</button></div>` : "";
    e.innerHTML = bandeau + segments({ salons: "# Salons", forum: "💬 Forum" }, t, "data-comm") + `<div id="zone"></div>`;
    if (!C.utilisateur) return;
    if (t === "salons") $("zone").innerHTML = `<div class="liste">${C.SALONS.map((s) => `<button class="ligneL salon" data-salon="${s.id}"><span class="ico">#</span><span class="txt"><b>${esc(s.nom)}</b><span>${esc(s.desc)}</span></span><span class="chevron">›</span></button>`).join("")}</div>`;
    else {
      $("zone").innerHTML = `<button class="btn" data-nouveau-sujet>＋ Nouveau sujet</button><h2 class="sec">Sujets récents</h2><div class="liste" id="sujets"><div class="vide">Chargement…</div></div>`;
      arreter = C.ecouterSujets((l, err) => {
        const z = $("sujets"); if (!z) return;
        if (err) return (z.innerHTML = `<div class="vide">Impossible de charger le forum.</div>`);
        z.innerHTML = l.map((s) => `<button class="ligneL sujet" data-sujet="${s.id}"><span class="av" style="background:${couleur(s.auteur)}">${initiale(s.pseudo)}</span><span class="txt"><b>${esc(s.titre)}</b><span>${esc(C.CATS_FORUM[s.categorie] || "")} · ${esc(s.pseudo)} · ${heure(s.derniere)}</span></span><span class="droite"><b>${s.nbReponses || 0}</b>rép.</span></button>`).join("") || '<div class="vide">Aucun sujet. Lance le premier !</div>';
      });
    }
  },

  salon(e, id) {
    if (!C?.utilisateur) return aller("communaute");
    const s = C.SALONS.find((x) => x.id === id) || C.SALONS[0];
    $("titreApp").innerHTML = "# " + esc(s.nom);
    e.className += " chat";
    e.innerHTML = `<div class="chatTete"><b># ${esc(s.nom)}</b><span>${esc(s.desc)} · Règles : respect, pas de spoiler sans prévenir, pas de liens douteux</span></div>
      <div class="messages" id="messages"><div class="vide">Chargement…</div></div>
      ${C.peutEcrire() ? `<form class="saisie" id="formChat"><textarea id="texteChat" maxlength="500" placeholder="Écrire dans #${esc(s.nom)}" rows="1"></textarea><button id="envoyer" aria-label="Envoyer">➤</button></form>` : `<div class="saisie"><p class="info">${C.profil?.banni ? "Ton compte est suspendu." : "Termine ton inscription dans Profil pour écrire."}</p></div>`}`;
    let premier = true;
    arreter = C.ecouterSalon(s.id, (msgs, err) => {
      const z = $("messages"); if (!z) return;
      if (err) return (z.innerHTML = `<div class="vide">Impossible de charger les messages.</div>`);
      const bas = z.scrollHeight - z.scrollTop - z.clientHeight < 80;
      z.innerHTML = msgs.length ? msgs.map((m, i) => {
        const suite = i > 0 && msgs[i - 1].auteur === m.auteur;
        const moi = m.auteur === C.utilisateur.uid;
        return `<div class="msg ${suite ? "suite" : ""}" data-msg="${m.id}"><span class="av" style="background:${couleur(m.auteur)}">${initiale(m.pseudo)}</span><div class="corps">${suite ? "" : `<div class="qui" style="color:${couleur(m.auteur)}">${esc(m.pseudo)}<small>${heure(m.date)}</small></div>`}<div class="texte">${esc(m.texte)}</div></div>
          <div class="actions">${moi || C.admin ? `<button data-suppr-msg="${m.id}">Supprimer</button>` : ""}${moi ? "" : `<button data-signaler="salons/${s.id}/messages/${m.id}" data-qui="${esc(m.auteur)}" data-pseudo="${esc(m.pseudo)}" data-texte="${esc(m.texte)}">Signaler</button>`}</div></div>`;
      }).join("") : `<div class="vide">Aucun message. Dis bonjour 👋</div>`;
      if (premier || bas) z.scrollTop = z.scrollHeight;
      premier = false;
    });
    const f = $("formChat");
    if (f) {
      const ta = $("texteChat");
      ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } });
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try { $("envoyer").disabled = true; await C.envoyer(s.id, ta.value); ta.value = ""; }
        catch (er) { toast(er.message); }
        finally { $("envoyer").disabled = false; ta.focus(); }
      });
    }
  },

  sujet(e, id) {
    if (!C?.utilisateur) return aller("communaute");
    e.innerHTML = `<div id="filSujet"><div class="vide">Chargement…</div></div>
      ${C.peutEcrire() ? `<textarea class="champ" id="texteRep" maxlength="2000" placeholder="Ta réponse…"></textarea><button class="btn" id="envoyerRep">Répondre</button>` : ""}`;
    const fil = { sujet: null, reponses: [] };
    arreter = C.ecouterSujet(id, (part) => {
      Object.assign(fil, part);
      const z = $("filSujet"); if (!z) return;
      if (!fil.sujet) return (z.innerHTML = `<div class="vide">Ce sujet n'existe plus.</div>`);
      const bloc = (m, chemin, estSujet) => `<div class="message-sujet"><div class="qui"><span class="av" style="width:30px;height:30px;font-size:.75rem;background:${couleur(m.auteur)}">${initiale(m.pseudo)}</span>${esc(m.pseudo)}<small>${heure(m.date)}</small></div>
        ${estSujet ? `<h3 style="margin-bottom:8px">${esc(m.titre)}</h3>` : ""}<p>${esc(m.texte)}</p>
        <div class="actions">${m.auteur === C.utilisateur.uid || C.admin ? `<button data-suppr-chemin="${chemin}">Supprimer</button>` : ""}${m.auteur !== C.utilisateur.uid ? `<button data-signaler="${chemin}" data-qui="${esc(m.auteur)}" data-pseudo="${esc(m.pseudo)}" data-texte="${esc(m.titre || m.texte)}">Signaler</button>` : ""}</div></div>`;
      z.innerHTML = bloc(fil.sujet, `sujets/${id}`, true) + `<h2 class="sec">${fil.reponses.length} réponse${fil.reponses.length > 1 ? "s" : ""}</h2>` + fil.reponses.map((r) => bloc(r, `sujets/${id}/reponses/${r.id}`)).join("");
    });
    $("envoyerRep")?.addEventListener("click", async () => {
      try { $("envoyerRep").disabled = true; await C.repondre(id, $("texteRep").value); $("texteRep").value = ""; }
      catch (er) { toast(er.message); } finally { $("envoyerRep").disabled = false; }
    });
  },

  profil(e) {
    if (!C) return ecranBientot(e);
    if (!C.utilisateur) return ecranConnexion(e);
    if (!C.emailVerifie()) return (e.innerHTML = `<div class="bienvenue"><small>Presque fini</small><h1>Vérifie ton e-mail</h1><p>On t'a envoyé un lien à <b>${esc(C.utilisateur.email)}</b>. Clique dessus, puis reviens ici.</p></div>
      <button class="btn" data-action="verifie">J'ai cliqué sur le lien</button><button class="btn secondaire" data-action="renvoyer">Renvoyer l'e-mail</button><button class="btn secondaire" data-action="deconnexion">Se déconnecter</button>`);
    if (!C.profil) return ecranPseudo(e);
    e.innerHTML = `<div class="profilCarte"><span class="av" style="background:${couleur(C.utilisateur.uid)}">${initiale(C.profil.pseudo)}</span><div><b style="font-size:1.15rem">${esc(C.profil.pseudo)}</b>${C.admin ? ' <span class="puce">Admin</span>' : ""}<div style="color:var(--gris);font-size:.82rem">${esc(C.utilisateur.email || "")}</div></div></div>
      ${C.profil.banni ? '<p class="erreur">Ton compte est suspendu : tu ne peux plus écrire.</p>' : ""}
      ${C.admin ? `<h2 class="sec">Modération · signalements</h2><div id="signalements" class="liste"><div class="vide">Chargement…</div></div>` : ""}
      <h2 class="sec">Règles de la communauté</h2>${REGLES}
      <button class="btn secondaire" data-action="deconnexion">Se déconnecter</button>
      <p class="vide" style="padding:16px 0 0">Site de fans non officiel, non affilié à Rockstar Games.</p>`;
    if (C.admin) arreter = C.ecouterSignalements((l) => {
      const z = $("signalements"); if (!z) return;
      z.innerHTML = l.map((r) => `<div class="ligneL" style="flex-wrap:wrap"><span class="txt"><b>${esc(r.pseudoSignale || "?")}</b><span>${esc(r.texte)}</span></span>
        <span style="display:flex;gap:6px;width:100%;margin-top:6px"><button class="puce" data-mod="supprimer" data-id="${r.id}" data-chemin="${esc(r.chemin)}">Supprimer</button><button class="puce" data-mod="bannir" data-id="${r.id}" data-qui="${esc(r.auteurSignale)}" data-chemin="${esc(r.chemin)}">Bannir</button><button class="puce" data-mod="ignorer" data-id="${r.id}">Ignorer</button></span></div>`).join("") || '<div class="vide">Aucun signalement 👌</div>';
    });
  },
};

ECRANS.installer = (e) => { ECRANS.accueil(e); $("titreApp").innerHTML = TITRES.accueil; document.querySelector('[data-aller="accueil"]').classList.add("actif"); setTimeout(feuilleInstaller, 50); };
const SALONS_DEMO = [{ id: "general", nom: "général", desc: "Discussion libre sur GTA 6" }, { id: "argent", nom: "argent-et-planques", desc: "Planques et argent" }, { id: "armes", nom: "armes", desc: "Armes cachées" }];
const REGLES = `<ul class="regles"><li>16 ans minimum.</li><li>Respect : pas d'insultes, de harcèlement ni de propos haineux.</li><li>Pas de spoiler de l'histoire sans prévenir.</li><li>Pas de pub, d'arnaque ni de liens douteux (seuls YouTube, TikTok et Instagram sont autorisés).</li><li>Pas d'infos personnelles (adresse, téléphone…), ni les tiennes, ni celles des autres.</li><li>Un message signalé peut être supprimé ; en cas d'abus, le compte est suspendu.</li></ul>`;

function ligneActu(x) {
  const [ico, nom] = CAT_ACTU[x.categorie] || ["📰", "Info"];
  return ligne(ico, "", esc(x.titre), `${nom} · ${dateCourte(x.date)}`, "", `data-actu="${esc(x.id)}"`);
}
function ecranBientot(e) {
  e.innerHTML = `<div class="bienvenue"><small>Bientôt</small><h1>La communauté arrive</h1><p>Salons de discussion façon Discord, forum, comptes Google ou e-mail. Elle sera ouverte très vite !</p></div>
    <h2 class="sec">Salons prévus</h2><div class="liste">${["général", "argent-et-planques", "armes", "vehicules", "secrets-et-easter-eggs", "entraide-missions"].map((n) => `<div class="ligneL salon"><span class="ico">#</span><span class="txt"><b>${n}</b><span>Bientôt ouvert</span></span></div>`).join("")}</div>`;
}
function ecranConnexion(e) {
  e.innerHTML = `<div class="bienvenue"><small>Communauté</small><h1>Connexion</h1><p>Un compte gratuit pour discuter avec les autres joueurs.</p></div>
    <button class="btn google" data-action="google"><b style="font-size:1.1rem">G</b> Continuer avec Google</button>
    <div class="sep">ou avec ton e-mail</div>
    <input class="champ" id="email" type="email" autocomplete="email" placeholder="Adresse e-mail">
    <input class="champ" id="mdp" type="password" autocomplete="current-password" placeholder="Mot de passe (8 caractères minimum)">
    <button class="btn" data-action="connexion">Se connecter</button>
    <button class="btn secondaire" data-action="inscription">Créer un compte</button>
    <button class="btn secondaire" data-action="oubli" style="font-size:.82rem">Mot de passe oublié</button>
    <p id="msgConnexion"></p>`;
}
function ecranPseudo(e) {
  e.innerHTML = `<div class="bienvenue"><small>Dernière étape</small><h1>Choisis ton pseudo</h1><p>C'est le nom que les autres verront dans les salons.</p></div>
    <input class="champ" id="pseudo" maxlength="20" placeholder="Pseudo (3 à 20 caractères)">
    <label class="case"><input type="checkbox" id="age"> J'ai 16 ans ou plus.</label>
    <label class="case"><input type="checkbox" id="regles"> J'accepte les règles de la communauté.</label>
    ${REGLES}
    <button class="btn" data-action="pseudo">C'est parti</button><p id="msgPseudo"></p>`;
}

// ---------- feuille du bas (détails) ----------
function ouvrirFeuille(html) { $("feuilleContenu").innerHTML = html; $("feuille").classList.add("ouvert"); $("voile").classList.add("ouvert"); $("feuille").scrollTop = 0; }
function fermerFeuille() { $("feuille").classList.remove("ouvert"); $("voile").classList.remove("ouvert"); const f = $("feuilleContenu").querySelector("iframe"); if (f) f.src = "about:blank"; }
$("voile").addEventListener("click", fermerFeuille);
// glisser vers le bas pour fermer
let y0 = null;
$("feuille").addEventListener("touchstart", (ev) => { if ($("feuille").scrollTop <= 0) y0 = ev.touches[0].clientY; }, { passive: true });
$("feuille").addEventListener("touchend", (ev) => { if (y0 !== null && ev.changedTouches[0].clientY - y0 > 90) fermerFeuille(); y0 = null; }, { passive: true });

const EMBED = { youtube: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`, tiktok: (id) => `https://www.tiktok.com/embed/v2/${id}`, instagram: (id) => `https://www.instagram.com/reel/${id}/embed/` };
const ID_OK = { youtube: /^[A-Za-z0-9_-]{11}$/, tiktok: /^\d{15,25}$/, instagram: /^[A-Za-z0-9_-]{5,20}$/ };

let toastTimer;
function toast(t) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.style.cssText = "position:fixed;left:50%;bottom:calc(var(--bas) + 18px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#22222c;border:1px solid #33333f;color:#fff;padding:11px 16px;border-radius:14px;font-size:.86rem;z-index:60;max-width:90vw;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)"; document.body.appendChild(el); }
  el.textContent = t; el.style.display = "block"; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.display = "none"), 3200);
}

// ---------- un seul écouteur pour tous les clics ----------
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,[data-zone]");
  if (!t) { document.querySelectorAll(".msg.choisi").forEach((m) => m.classList.remove("choisi")); const m = ev.target.closest(".msg"); if (m) m.classList.add("choisi"); return; }
  const d = t.dataset;
  if (t.id === "retour") return history.length > 1 ? history.back() : aller("communaute");
  if (d.aller) return aller(d.aller);
  if (d.infos) { etat.infos = d.infos; etat.q = ""; if (route().nom !== "infos") return aller("infos"); return rafraichir(); }
  if (d.classeA !== undefined) { etat.classeA = d.classeA; return rafraichir(); }
  if (d.classeV !== undefined) { etat.classeV = d.classeV; return rafraichir(); }
  if (d.comm) { etat.comm = d.comm; return rafraichir(); }
  if (d.salon) { if (!C?.utilisateur) { etat.comm = "salons"; return aller(C ? "profil" : "communaute"); } return aller("salon/" + d.salon); }
  if (d.sujet) return aller("sujet/" + d.sujet);
  if (d.actu !== undefined) {
    const x = D.actus.find((a) => a.id === d.actu); if (!x) return;
    return ouvrirFeuille(`<span class="puce">${esc((CAT_ACTU[x.categorie] || ["", "Info"])[1])}</span> <span class="puce" style="background:rgba(61,220,151,.15);color:var(--ok)">✓ Confirmé</span><h3>${esc(x.titre)}</h3><p>${esc(x.resume)}</p>${sources(x.sources)}`);
  }
  if (d.arme) {
    const a = D.armes.find((x) => x.nom === d.arme); if (!a) return;
    return ouvrirFeuille(`<span class="puce">${esc(CLASSES_A[a.classe] || "")}</span><h3>${esc(a.nom)}</h3><div class="prix">${dollars(a.prix) || "Prix ?"}</div>
      ${stat("Dégâts", a.degats)}${stat("Précision", a.precision)}${stat("Maniabilité", a.maniabilite)}${stat("Portée", a.portee)}
      ${a.chargeur ? `<p>🔄 ${a.chargeur} balles par chargeur</p>` : ""}${a.ouAcheter ? `<p>🛒 ${esc(a.ouAcheter)}</p>` : ""}${a.infos ? `<p>${esc(a.infos)}</p>` : ""}${sources(a.sources)}`);
  }
  if (d.veh) {
    const v = D.vehicules.find((x) => x.nom === d.veh); if (!v) return;
    return ouvrirFeuille(`<span class="puce">${esc(CLASSES_V[v.classe] || "")}</span><h3>${esc(v.nom)}</h3>${v.prix ? `<div class="prix">${dollars(v.prix)}</div>` : ""}
      ${stat("Vitesse", v.vitesse)}${stat("Accélération", v.acceleration)}${stat("Tenue de route", v.maniabilite)}${v.ouTrouver ? `<p>📍 ${esc(v.ouTrouver)}</p>` : ""}${sources(v.sources)}`);
  }
  if (d.video) {
    const [p, id] = d.video.split(":"); const v = D.videos.find((x) => plat(x) === p && x.id === id);
    if (!v || !ID_OK[p]?.test(id)) return;
    return ouvrirFeuille(`<iframe class="lecteur ${p === "youtube" ? "" : "vertical"}" src="${EMBED[p](id)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe><h3>${esc(v.titre)}</h3><p style="color:var(--gris)">${esc(CATS_VIDEO[v.categorie] || "")}${v.chaine ? " · " + esc(v.chaine) : ""}</p><a class="btn secondaire" href="${urlOk(v.url)}" target="_blank" rel="noopener">Ouvrir sur ${p === "youtube" ? "YouTube" : p === "tiktok" ? "TikTok" : "Instagram"}</a>`);
  }
  if (d.zone) {
    const l = D.actus.filter((x) => x.zone === d.zone);
    return ouvrirFeuille(`<h3>${esc(ZONES[d.zone][0])}</h3>${l.length ? `<div class="liste" style="margin-top:12px">${l.map(ligneActu).join("")}</div>` : '<p>Aucune info confirmée dans ce comté pour l\'instant.</p>'}`);
  }
  if (d.nouveauSujet !== undefined) {
    return ouvrirFeuille(`<h3>Nouveau sujet</h3><select class="champ" id="catSujet">${Object.entries(C.CATS_FORUM).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <input class="champ" id="titreSujet" maxlength="100" placeholder="Titre"><textarea class="champ" id="texteSujet" maxlength="3000" placeholder="Ton message"></textarea>
      <button class="btn" data-action="publierSujet">Publier</button>`);
  }
  if (d.supprMsg) { if (confirm("Supprimer ce message ?")) await C.supprimerMessage(route().param, d.supprMsg).catch((e) => toast(e.message)); return; }
  if (d.supprChemin) { if (confirm("Supprimer ?")) { await C.supprimerChemin(d.supprChemin).catch((e) => toast(e.message)); if (!d.supprChemin.includes("/reponses/")) aller("communaute"); } return; }
  if (d.signaler) { await C.signaler(d.signaler, d.texte, d.qui, d.pseudo).then(() => toast("Merci, le message a été signalé à la modération.")).catch((e) => toast(e.message)); return; }
  if (d.mod) {
    try {
      if (d.mod === "supprimer") await C.supprimerChemin(d.chemin).catch(() => {});
      if (d.mod === "bannir") { if (!confirm("Bannir ce membre ?")) return; await C.bannir(d.qui); await C.supprimerChemin(d.chemin).catch(() => {}); }
      await C.fermerSignalement(d.id); toast("C'est fait.");
    } catch (e) { toast(e.message); }
    return;
  }
  if (d.action) return actions(d.action);
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "q") { etat.q = ev.target.value; const pos = ev.target.selectionStart; rafraichir().then(() => { const q = $("q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }); }
});

const MSG_ERREUR = { "auth/invalid-email": "Adresse e-mail invalide.", "auth/missing-password": "Entre un mot de passe.", "auth/weak-password": "Mot de passe trop faible (8 caractères minimum).", "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail : connecte-toi.", "auth/invalid-credential": "E-mail ou mot de passe incorrect.", "auth/too-many-requests": "Trop d'essais, réessaie dans quelques minutes.", "auth/popup-closed-by-user": "Connexion annulée.", "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase." };
const msgErreur = (e) => MSG_ERREUR[e.code] || e.message;
async function actions(a) {
  const msg = (id, t, err = true) => { const el = $(id); if (el) { el.className = err ? "erreur" : "info"; el.textContent = t; } };
  try {
    if (a === "feuilleInstaller") return feuilleInstaller();
    if (a === "google") await C.connexionGoogle();
    if (a === "connexion") await C.connexionEmail($("email").value.trim(), $("mdp").value);
    if (a === "inscription") { if ($("mdp").value.length < 8) return msg("msgConnexion", "Mot de passe : 8 caractères minimum."); await C.inscriptionEmail($("email").value.trim(), $("mdp").value); }
    if (a === "oubli") { await C.motDePasseOublie($("email").value.trim()); msg("msgConnexion", "E-mail de réinitialisation envoyé.", false); }
    if (a === "verifie") { await C.verifierEncore(); if (!C.emailVerifie()) toast("Pas encore vérifié : clique sur le lien dans l'e-mail."); rafraichir(); }
    if (a === "renvoyer") { await C.renvoyerVerification(); toast("E-mail renvoyé."); }
    if (a === "deconnexion") { await C.deconnexion(); aller("accueil"); }
    if (a === "pseudo") {
      if (!$("age").checked) return msg("msgPseudo", "Il faut avoir 16 ans ou plus.");
      if (!$("regles").checked) return msg("msgPseudo", "Accepte les règles pour continuer.");
      await C.creerProfil($("pseudo").value); majAvatar(); toast("Bienvenue " + C.profil.pseudo + " !"); aller("communaute");
    }
    if (a === "installer") { if (invite) { invite.prompt(); await invite.userChoice; invite = null; } fermerFeuille(); return; }
    if (a === "publierSujet") { const id = await C.creerSujet($("titreSujet").value, $("texteSujet").value, $("catSujet").value); fermerFeuille(); aller("sujet/" + id); }
  } catch (e) { const t = msgErreur(e); if ($("msgConnexion")) msg("msgConnexion", t); else if ($("msgPseudo")) msg("msgPseudo", t); else toast(t); }
}

// ---------- installation (service worker + bouton Installer) ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let invite = null;
const installee = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invite = e; if (route().nom === "accueil") rafraichir(); });
addEventListener("appinstalled", () => { invite = null; toast("Appli installée ✅"); });
function feuilleInstaller() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  ouvrirFeuille(`<h3>Installer l'appli</h3>${invite ? `<p>Ton téléphone peut l'installer directement :</p><button class="btn" data-action="installer">⬇️ Installer maintenant</button>` : ""}
    <p>${ios ? "Sur iPhone : dans <b>Safari</b>, touche Partager (carré avec une flèche) → <b>Sur l'écran d'accueil</b> → Ajouter." : "Sur Android : menu <b>⋮</b> de Chrome → <b>Installer l'application</b> (ou « Ajouter à l'écran d'accueil »). Sur PC : icône d'installation à droite de la barre d'adresse."}</p>`);
}
rafraichir();
