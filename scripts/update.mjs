// GTA VI à la loupe — mise à jour quotidienne automatique
// Lancé chaque jour par GitHub Actions (.github/workflows/maj-quotidienne.yml)
// 1) lit les flux d'actus GTA 6  2) l'IA Gemini trie et résume  3) met à jour data/contenu.json
// Aucune dépendance : Node 20+ suffit.

import { readFile, writeFile } from "node:fs/promises";

const FICHIER = new URL("../data/contenu.json", import.meta.url);
const CLE = process.env.GEMINI_API_KEY;
const MOCK = process.env.MOCK === "1"; // mode test hors-ligne

const CATEGORIES = ["actus", "secrets", "astuces", "vehicules", "armes", "argent", "lieux"];
const ZONES = ["vice-city", "leonida-keys", "grassrivers", "port-gellhorn", "ambrosia", "mount-kalaga", "inconnue"];

const q = (s, hl = "fr", gl = "BE") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(s)}+when:2d&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;

const FLUX = [
  q("GTA 6"),
  q("GTA 6 astuce"),
  q("GTA 6 easter egg"),
  q("GTA 6 argent"),
  q("GTA 6", "en-US", "US"),
  q("GTA 6 easter egg OR secret", "en-US", "US"),
  q("GTA 6 vehicles OR cars", "en-US", "US"),
  q("GTA 6 weapons OR guns", "en-US", "US"),
  q("GTA 6 money OR tips", "en-US", "US"),
  q("GTA 6 map location", "en-US", "US"),
  "https://www.reddit.com/r/GTA6/top/.rss?t=day",
  "https://www.reddit.com/r/GTAVI/top/.rss?t=day",
];

// ---------- lecture RSS / Atom sans librairie ----------
const decode = (s = "") =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();

const tag = (bloc, nom) => {
  const m = bloc.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`, "i"));
  return m ? decode(m[1]) : "";
};

export function lireFlux(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    items.push({ titre: tag(b, "title"), lien: tag(b, "link"), date: tag(b, "pubDate"), site: tag(b, "source"), extrait: tag(b, "description").slice(0, 300) });
  }
  for (const m of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const b = m[0];
    const lien = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
    items.push({ titre: tag(b, "title"), lien: decode(lien), date: tag(b, "updated") || tag(b, "published"), site: "Reddit", extrait: tag(b, "content").slice(0, 300) });
  }
  return items.filter((i) => i.titre && i.lien);
}

async function telecharger(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (gta6-a-la-loupe bot)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return lireFlux(await r.text());
  } catch (e) {
    console.log("⚠️ flux ignoré :", url.slice(0, 80), "-", e.message);
    return [];
  }
}

// ---------- IA Gemini ----------
const MODELES = (process.env.GEMINI_MODEL || "gemini-flash-latest,gemini-2.5-flash,gemini-2.0-flash").split(",");

function consigne(liste, enAttente = []) {
  return `Tu es le rédacteur d'un site de fans francophone NON OFFICIEL sur GTA 6 (Grand Theft Auto VI, sorti le 19 novembre 2026 sur PS5 et Xbox Series X|S, État de Leonida).
Voici des titres d'articles et de posts récents, numérotés :
${liste.map((a, i) => `[${i}] ${a.titre} (${a.site || "?"}) ${a.extrait ? "— " + a.extrait : ""}`).join("\n")}

Ta mission : extraire les informations UTILES pour les joueurs et les classer.
Règles :
- Écris en français, avec TES PROPRES MOTS (jamais de copie de phrases des articles).
- Regroupe les doublons (plusieurs articles sur la même info = une seule entrée avec plusieurs sources).
- Ignore : pubs, promos, ventes, avis/notes du jeu, débats sans info, mèmes, contenu sans rapport avec GTA 6.
- N'invente RIEN : n'écris que ce que les titres/extraits disent. Si c'est flou, ne l'ajoute pas.
- categorie parmi : ${CATEGORIES.join(", ")}
  (actus = nouvelles du jeu/Rockstar ; secrets = easter eggs, détails cachés ; astuces = conseils, méthodes ; vehicules ; armes ; argent = façons de gagner de l'argent, systèmes économiques ; lieux = un endroit précis de la carte)
- Pour chaque entrée, cite TOUTES les sources [x] qui disent la même chose : une info n'est publiée que si au moins 2 sites différents la confirment (ou Rockstar/Take-Two officiellement).
- N'ajoute une entrée que si tu es certain que les titres/extraits l'affirment clairement (pas de « rumeur », « leak », « pourrait », « selon un insider »).
- spoiler : true si ça révèle l'histoire (missions, fin, morts, rebondissements).
- zone : pour "lieux", "secrets" et "astuces" liés à un endroit, choisis parmi ${ZONES.join(", ")} ; sinon null.
- titre : court (max 80 caractères). resume : 1 à 3 phrases (max 300 caractères).
- sources : les numéros [x] utilisés.
${enAttente.length ? `
Infos EN ATTENTE de confirmation (déjà vues sur 1 seul site) :
${enAttente.map((e) => `(${e.id}) ${e.titre} — ${e.resume}`).join("\n")}
Si un des articles ci-dessus dit clairement LA MÊME CHOSE qu'une info en attente, ajoute-la dans "confirmations" avec son id et les numéros [x] des articles.` : ""}
Réponds UNIQUEMENT en JSON : {"entrees":[{"categorie":"","titre":"","resume":"","spoiler":false,"zone":null,"sources":[0]}],"confirmations":[{"id":"","sources":[0]}]}
Si rien d'utile : {"entrees":[],"confirmations":[]}`;
}

async function demanderIA(texte) {
  if (MOCK) return JSON.parse(await readFile(new URL("../test/reponse-ia.json", import.meta.url), "utf8"));
  let derniere;
  for (const modele of MODELES) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele.trim()}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": CLE },
        body: JSON.stringify({
          contents: [{ parts: [{ text: texte }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(120000),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || "HTTP " + r.status);
      const brut = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}";
      console.log("🤖 modèle utilisé :", modele);
      return JSON.parse(brut.replace(/^```json|```$/g, "").trim());
    } catch (e) {
      derniere = e;
      console.log("⚠️ modèle", modele, "indisponible :", e.message);
    }
  }
  throw derniere;
}

// ---------- programme principal ----------
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Règle de fiabilité : publié seulement si 2 sites différents (ou une source officielle Rockstar/Take-Two)
const OFFICIEL = /rockstar|take-?two/i;
export function estConfirme(sources) {
  if (sources.some((s) => OFFICIEL.test(s.nom) || /rockstargames\.com|take2games\.com/i.test(s.url))) return true;
  return new Set(sources.map((s) => norm(s.nom))).size >= 2;
}

export async function principal() {
  if (!CLE && !MOCK) {
    console.error("❌ GEMINI_API_KEY manquante (Settings > Secrets and variables > Actions)");
    process.exit(1);
  }
  const data = JSON.parse(await readFile(FICHIER, "utf8"));
  data.liensVus ||= [];
  const vus = new Set(data.liensVus);

  let articles;
  if (MOCK) articles = lireFlux(await readFile(new URL("../test/flux-exemple.xml", import.meta.url), "utf8"));
  else articles = (await Promise.all(FLUX.map(telecharger))).flat();

  const limite = Date.now() - 3 * 24 * 3600 * 1000;
  const titresVus = new Set();
  articles = articles.filter((a) => {
    const t = norm(a.titre);
    if (vus.has(a.lien) || titresVus.has(t)) return false;
    titresVus.add(t);
    const d = Date.parse(a.date);
    return isNaN(d) || d > limite;
  }).slice(0, 80);

  console.log(`📰 ${articles.length} nouveaux articles trouvés`);
  let ajoutes = 0;

  if (articles.length) {
    const enAttente = data.entrees.filter((e) => e.statut !== "confirme");
    const rep = await demanderIA(consigne(articles, enAttente));
    const dejaTitres = new Set(data.entrees.map((e) => norm(e.titre)));
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const nouvelles = [];
    for (const e of rep.entrees || []) {
      if (!CATEGORIES.includes(e.categorie) || !e.titre || !e.resume) continue;
      if (dejaTitres.has(norm(e.titre))) continue;
      const sources = (e.sources || []).map((i) => articles[i]).filter(Boolean).map((a) => ({ nom: a.site || "Source", url: a.lien }));
      if (!sources.length) continue;
      dejaTitres.add(norm(e.titre));
      nouvelles.push({
        id: aujourdhui + "-" + Math.random().toString(36).slice(2, 8),
        date: aujourdhui,
        categorie: e.categorie,
        titre: String(e.titre).slice(0, 100),
        resume: String(e.resume).slice(0, 400),
        statut: estConfirme(sources) ? "confirme" : "non-verifie",
        spoiler: !!e.spoiler,
        zone: ZONES.includes(e.zone) ? e.zone : null,
        sources: sources.slice(0, 4),
      });
    }
    // infos en attente confirmées aujourd'hui par un 2e site
    let confirmees = 0;
    for (const c of rep.confirmations || []) {
      const e = enAttente.find((x) => x.id === c.id);
      if (!e) continue;
      for (const a of (c.sources || []).map((i) => articles[i]).filter(Boolean))
        if (!e.sources.some((s) => s.url === a.lien)) e.sources.push({ nom: a.site || "Source", url: a.lien });
      if (estConfirme(e.sources)) { e.statut = "confirme"; e.date = aujourdhui; confirmees++; }
    }
    ajoutes = nouvelles.filter((e) => e.statut === "confirme").length + confirmees;
    data.entrees = [...nouvelles, ...data.entrees].slice(0, 2000);
    console.log(`⏳ ${nouvelles.length - nouvelles.filter((e) => e.statut === "confirme").length} infos mises en attente d'une 2e source, ${confirmees} confirmées aujourd'hui`);
  }

  // une info jamais confirmée après 14 jours est supprimée
  const limiteAttente = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  data.entrees = data.entrees.filter((e) => e.statut === "confirme" || e.date >= limiteAttente);
  data.entrees.sort((a, b) => b.date.localeCompare(a.date));

  data.liensVus = [...articles.map((a) => a.lien), ...data.liensVus].slice(0, 3000);
  data.derniereMaj = new Date().toISOString();
  data.dernierAjout = ajoutes;
  await writeFile(FICHIER, JSON.stringify(data, null, 1) + "\n");
  console.log(`✅ ${ajoutes} infos confirmées publiées (total publié : ${data.entrees.filter((e) => e.statut === "confirme").length})`);
}

// ---------- arsenal : fiches détaillées des armes ----------
const FICHIER_ARMES = new URL("../data/armes.json", import.meta.url);
const CLASSES = ["pistolets", "revolvers", "mitraillettes", "fusils-a-pompe", "fusils-assaut", "fusils-tactiques", "snipers", "lourdes", "melee", "explosifs"];
const STATS = ["degats", "precision", "maniabilite", "portee", "prix", "chargeur", "ouAcheter", "infos"];
const PAGES_ARMES = [
  { nom: "GTA6DB", url: "https://gta6db.io/weapons" },
  { nom: "MetaForge", url: "https://metaforge.app/gta-6/best-weapons-gta-6" },
  { nom: "eGamers", url: "https://egamers.io/gta-6-weapons-guide-every-class-launcher-and-sniper-prices-and-which-ammu-nation-stores-sell-them/" },
  { nom: "MeowDB", url: "https://meowdb.com/gta6/weapons" },
];

const texteDePage = (html) => decode(html.replace(/<(script|style|nav|footer|svg)[\s\S]*?<\/\1>/gi, " ")).slice(0, 25000);

function consigneArmes(pages, connues) {
  return `Tu remplis la base de données des armes d'un site de fans francophone NON OFFICIEL sur GTA 6.
Voici le texte de pages qui listent les armes du jeu (numérotées) :
${pages.map((p, i) => `===== PAGE [${i}] ${p.nom} =====\n${p.texte}`).join("\n")}

Armes déjà connues : ${connues.join(", ") || "aucune"}.
Extrais CHAQUE arme de GTA 6 citée avec ses infos FACTUELLES uniquement (n'invente rien ; une info absente = null).
- classe parmi : ${CLASSES.join(", ")}
- degats, precision, maniabilite, portee : nombres sur 10 tels qu'affichés dans le jeu (ex. 4.2), sinon null
- prix : nombre en dollars du jeu sans symbole (ex. 1450), sinon null
- chargeur : nombre de munitions par chargeur, sinon null
- ouAcheter : magasin ou condition de déblocage, en français court, sinon null
- infos : 1 phrase en français avec TES mots (pas de copie), sinon null
- ameliorations : liste des accessoires/améliorations connus [{"nom":"Silencieux","prix":250,"effet":"phrase courte ou null"}], sinon []
- sources : numéros des pages utilisées
Garde le nom exact de l'arme tel qu'écrit dans le jeu. Ignore les armes de GTA 5/Online.
Réponds UNIQUEMENT en JSON : {"armes":[{"nom":"","classe":"","degats":null,"precision":null,"maniabilite":null,"portee":null,"prix":null,"chargeur":null,"ouAcheter":null,"infos":null,"ameliorations":[],"sources":[0]}]}`;
}

const domaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

// Une valeur n'est publiée que si 2 sites différents donnent EXACTEMENT la même.
// En attendant, elle est gardée dans "candidats" (non affichée).
export function fusionnerArme(base, n, sources) {
  base.candidats ||= {};
  const doms = sources.map((s) => domaine(s.url));
  const voter = (cle, valeur) => {
    const c = (base.candidats[cle] ||= {});
    const v = (c[JSON.stringify(valeur)] ||= []);
    for (const dm of doms) if (!v.includes(dm)) v.push(dm);
    return v.length;
  };
  for (const k of STATS) {
    const v = n[k];
    if (v === null || v === undefined || v === "") continue;
    const votes = voter(k, v);
    if (votes < 2) continue;
    if (base[k] === null || base[k] === undefined) base[k] = v;
    else if (JSON.stringify(base[k]) !== JSON.stringify(v)) {
      // deux valeurs différentes confirmées chacune par 2 sites : on ne sait pas laquelle est vraie → "?"
      const msg = `${k} : ${base[k]} ou ${v} selon les sites`;
      if (!base.conflits.includes(msg)) base.conflits.push(msg);
      base[k] = null;
    }
  }
  for (const a of n.ameliorations || []) {
    if (!a?.nom) continue;
    const prix = typeof a.prix === "number" ? a.prix : null;
    if (voter("amelioration:" + norm(a.nom), prix) < 2) continue;
    if (!base.ameliorations.some((x) => norm(x.nom) === norm(a.nom)))
      base.ameliorations.push({ nom: String(a.nom).slice(0, 60), prix, effet: null });
  }
  for (const s of sources) if (!base.sources.some((x) => x.url === s.url)) base.sources.push(s);
  base.statut = new Set(base.sources.map((s) => domaine(s.url))).size >= 2 ? "confirme" : "non-verifie";
  return base;
}

export async function majArmes() {
  const data = JSON.parse(await readFile(FICHIER_ARMES, "utf8"));
  let pages;
  if (MOCK) pages = [{ nom: "Test", url: "https://exemple.com/armes", texte: "page test" }];
  else {
    pages = [];
    for (const p of PAGES_ARMES) {
      try {
        const r = await fetch(p.url, { headers: { "User-Agent": "Mozilla/5.0 (gta6-a-la-loupe bot)" }, signal: AbortSignal.timeout(25000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        pages.push({ ...p, texte: texteDePage(await r.text()) });
      } catch (e) { console.log("⚠️ page armes ignorée :", p.nom, "-", e.message); }
    }
  }
  if (!pages.length) return console.log("🔫 aucune page d'armes lisible aujourd'hui");

  const rep = MOCK
    ? JSON.parse(await readFile(new URL("../test/reponse-armes.json", import.meta.url), "utf8"))
    : await demanderIA(consigneArmes(pages, data.armes.map((a) => a.nom)));

  let nouvelles = 0, majs = 0;
  for (const n of rep.armes || []) {
    if (!n?.nom || !CLASSES.includes(n.classe)) continue;
    const sources = (n.sources || []).map((i) => pages[i]).filter(Boolean).map((p) => ({ nom: p.nom, url: p.url }));
    if (!sources.length) continue;
    let base = data.armes.find((a) => norm(a.nom) === norm(n.nom));
    if (!base) {
      base = { nom: String(n.nom).slice(0, 60), classe: n.classe, ameliorations: [], image: null, statut: "non-verifie", conflits: [], sources: [] };
      for (const k of STATS) base[k] = null;
      data.armes.push(base);
      nouvelles++;
    } else majs++;
    fusionnerArme(base, n, sources);
  }
  data.derniereMaj = new Date().toISOString();
  await writeFile(FICHIER_ARMES, JSON.stringify(data, null, 1) + "\n");
  console.log(`🔫 arsenal : ${nouvelles} nouvelles armes, ${majs} fiches complétées (total : ${data.armes.length})`);
}

async function tout() {
  await principal();
  try { await majArmes(); } catch (e) { console.log("⚠️ mise à jour des armes ratée :", e.message); }
}

if (import.meta.url === `file://${process.argv[1]}`) tout().catch((e) => { console.error("❌", e); process.exit(1); });
