#!/usr/bin/env node
/**
 * utils_alternance.js
 * Utilitaires pour la veille offres d'alternance (Notion + Make)
 *
 * Usage :
 *   node scripts/utils_alternance.js hash <url>
 *   node scripts/utils_alternance.js normalize <url>
 *   node scripts/utils_alternance.js payload <url> <title> <company> <city> <source>
 *   node scripts/utils_alternance.js match <text>
 *   node scripts/utils_alternance.js demo
 *
 * Exemples :
 *   node scripts/utils_alternance.js hash "https://www.francetravail.fr/offre/123?utm_source=test"
 *   node scripts/utils_alternance.js normalize "https://www.welcometothejungle.com/jobs/abc?ref=foo&utm_campaign=x"
 *   node scripts/utils_alternance.js match "Alternant ingénieur réseau et cybersécurité"
 *   node scripts/utils_alternance.js demo
 */

'use strict';

const crypto = require('crypto');
const url_module = require('url');

// ---------------------------------------------------------------------------
// 1. CONFIGURATION — mots-clés par domaine
// ---------------------------------------------------------------------------

const KEYWORDS = {
  Réseau: [
    'réseau', 'network', 'cisco', 'routing', 'switching', 'lan', 'wan',
    'tcp', 'ip', 'bgp', 'ospf', 'vlan', 'firewall', 'vpn', 'mpls',
    'sd-wan', 'wifi', 'wi-fi', 'nat', 'dns', 'dhcp', 'proxy',
  ],
  Cyber: [
    'cyber', 'cybersécurité', 'soc', 'siem', 'edr', 'xdr', 'iam',
    'pentest', 'intrusion', 'iso 27001', 'forensic', 'blue team', 'red team',
    'threat', 'rssi', 'ssi', 'pssi', 'pare-feu', 'endpoint', 'vulnérabilité',
  ],
  Supervision: [
    'supervision', 'monitoring', 'observabilité', 'observability',
    'zabbix', 'nagios', 'grafana', 'prometheus', 'splunk', 'datadog',
    'centreon', 'alerting', 'noc',
  ],
  Infrastructure: [
    'infrastructure', 'infra', 'systèmes', 'linux', 'windows server',
    'vmware', 'vsphere', 'hyper-v', 'cloud', 'aws', 'azure', 'gcp',
    'kubernetes', 'docker', 'devops', 'ansible', 'terraform',
    'virtualisation', 'stockage', 'sauvegarde',
  ],
  Gouvernance: [
    'gouvernance', 'grc', 'conformité', 'risques', 'risk', 'rssi',
    'pssi', 'iso 27001', 'iso 27005', 'ebios', 'dpo', 'rgpd', 'gdpr',
    'audit', 'politique de sécurité',
  ],
};

// Mots-clés obligatoires indiquant qu'il s'agit bien d'une alternance
const ALTERNANCE_KEYWORDS = [
  'alternance', 'alternant', 'alternante', 'apprentissage',
  "contrat d'apprentissage", 'contrat de professionnalisation',
  'en alternance', 'apprenti', 'apprentie',
];

// Rythme par défaut (valeur fixe injectée dans Notion)
const DEFAULT_RYTHME = '3 semaines entreprise / 1 semaine cours';

// Zones géographiques : mots présents dans la localisation
const ZONES = {
  'Nantes (+20 km)': [
    'nantes', 'saint-nazaire', 'saint nazaire', 'rezé', 'reze',
    'orvault', 'saint-herblain', 'saint herblain', 'vertou', 'carquefou',
    'bouguenais', 'couëron', 'coueron', 'sainte-luce', 'sainte luce',
    'basse-goulaine', 'basse goulaine', 'thouaré', 'thouare',
  ],
  "Les Sables-d'Olonne (+20 km)": [
    'sables', "sables-d'olonne", "sables d'olonne",
    "château-d'olonne", "chateau d'olonne", 'olonne',
    'talmont', 'jard', 'longeville',
  ],
};

// Paramètres de tracking à retirer des URLs
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'ref', 'source', 'from', 'origine', 'tracking', 'sid', 'cid',
];

// ---------------------------------------------------------------------------
// 2. FONCTIONS UTILITAIRES
// ---------------------------------------------------------------------------

/**
 * Normalise une URL en retirant les paramètres de tracking.
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new url_module.URL(rawUrl.trim());
    TRACKING_PARAMS.forEach(p => parsed.searchParams.delete(p));
    // Normaliser le protocole et le hostname en minuscules
    parsed.hostname = parsed.hostname.toLowerCase();
    // Retirer le slash final si pas de path
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    // URL invalide → retourner telle quelle (nettoyée)
    return rawUrl.trim();
  }
}

/**
 * Calcule l'ID unique (SHA-256 hex) d'une URL normalisée.
 * Retourne les 16 premiers caractères hex (64 bits d'entropie — suffisant pour V1).
 * @param {string} rawUrl
 * @returns {string}
 */
function computeUniqueId(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return hash.substring(0, 16);
}

/**
 * Détecte la zone géographique à partir d'un texte de localisation.
 * @param {string} localisation
 * @returns {string} 'Nantes (+20 km)' | "Les Sables-d'Olonne (+20 km)" | ''
 */
function detectZone(localisation) {
  if (!localisation) return '';
  const lower = localisation.toLowerCase();
  for (const [zone, keywords] of Object.entries(ZONES)) {
    if (keywords.some(k => lower.includes(k))) return zone;
  }
  return '';
}

/**
 * Détecte les domaines correspondants dans un texte (titre + description).
 * @param {string} text
 * @returns {string[]} liste de domaines matchés (ex: ['Réseau', 'Cyber'])
 */
function detectDomains(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return Object.entries(KEYWORDS)
    .filter(([, kws]) => kws.some(k => lower.includes(k.toLowerCase())))
    .map(([domain]) => domain);
}

/**
 * Vérifie qu'un texte contient bien un mot-clé "alternance".
 * @param {string} text
 * @returns {boolean}
 */
function isAlternance(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ALTERNANCE_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Construit un payload JSON prêt à être envoyé à l'API Notion via Make.
 * @param {Object} params
 * @returns {Object}
 */
function buildNotionPayload(params) {
  const {
    title = '',
    company = '',
    url = '',
    localisation = '',
    source = 'Site entreprise',
    datePublication = null,
    keywordsMatched = [],
  } = params;

  const normalizedUrl = normalizeUrl(url);
  const uniqueId = computeUniqueId(url);
  const zone = detectZone(localisation);
  const domains = detectDomains(`${title} ${localisation}`);
  const importDate = new Date().toISOString().split('T')[0];

  return {
    parent: { database_id: '{{DATABASE_ID_OFFRES}}' },
    properties: {
      Intitulé: {
        title: [{ text: { content: title } }],
      },
      Statut: {
        select: { name: 'À trier' },
      },
      Type: {
        select: { name: 'Alternance' },
      },
      Rythme: {
        rich_text: [{ text: { content: DEFAULT_RYTHME } }],
      },
      Lien: {
        url: normalizedUrl || null,
      },
      Source: {
        select: { name: source },
      },
      Localisation: {
        rich_text: [{ text: { content: localisation } }],
      },
      'Ville ciblée': zone
        ? { select: { name: zone } }
        : { select: null },
      Domaine: {
        multi_select: domains.map(d => ({ name: d })),
      },
      'Date d\'import': {
        date: { start: importDate },
      },
      'Date de publication': datePublication
        ? { date: { start: datePublication } }
        : { date: null },
      'ID unique': {
        rich_text: [{ text: { content: uniqueId } }],
      },
      'Mots-clés match': keywordsMatched.length > 0
        ? { rich_text: [{ text: { content: keywordsMatched.join(', ') } }] }
        : { rich_text: [] },
    },
  };
}

// ---------------------------------------------------------------------------
// 3. CLI
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`
Usage :
  node scripts/utils_alternance.js hash <url>
  node scripts/utils_alternance.js normalize <url>
  node scripts/utils_alternance.js payload <url> <title> <company> <localisation> <source>
  node scripts/utils_alternance.js match <text>
  node scripts/utils_alternance.js demo
`);
}

function runCli() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'hash': {
      const rawUrl = args[0];
      if (!rawUrl) { console.error('Erreur : URL manquante.'); process.exit(1); }
      const id = computeUniqueId(rawUrl);
      console.log(`URL originale  : ${rawUrl}`);
      console.log(`URL normalisée : ${normalizeUrl(rawUrl)}`);
      console.log(`ID unique      : ${id}`);
      break;
    }

    case 'normalize': {
      const rawUrl = args[0];
      if (!rawUrl) { console.error('Erreur : URL manquante.'); process.exit(1); }
      console.log(normalizeUrl(rawUrl));
      break;
    }

    case 'payload': {
      const [rawUrl, title, company, localisation, source] = args;
      if (!rawUrl) { console.error('Erreur : URL manquante.'); process.exit(1); }
      const payload = buildNotionPayload({
        title: title || 'Titre inconnu',
        company: company || '',
        url: rawUrl,
        localisation: localisation || '',
        source: source || 'Site entreprise',
      });
      console.log(JSON.stringify(payload, null, 2));
      break;
    }

    case 'match': {
      const text = args.join(' ');
      if (!text) { console.error('Erreur : texte manquant.'); process.exit(1); }
      const domains = detectDomains(text);
      const alt = isAlternance(text);
      const zone = detectZone(text);
      console.log(`Texte    : "${text}"`);
      console.log(`Alternance   : ${alt ? '✅ oui' : '❌ non'}`);
      console.log(`Domaines     : ${domains.length > 0 ? domains.join(', ') : '(aucun)'}`);
      console.log(`Zone détectée: ${zone || '(aucune)'}`);
      break;
    }

    case 'demo': {
      console.log('=== DÉMO utils_alternance.js ===\n');

      const testCases = [
        {
          url: 'https://www.francetravail.fr/offre/123456?utm_source=newsletter&utm_campaign=alternance',
          title: 'Alternant(e) ingénieur réseau et cybersécurité',
          company: 'Thales',
          localisation: 'Nantes (44)',
          source: 'France Travail',
        },
        {
          url: 'https://www.welcometothejungle.com/fr/companies/capgemini/jobs/alternance-supervision?ref=homepage',
          title: 'Alternance — Technicien supervision infrastructure',
          company: 'Capgemini',
          localisation: 'Les Sables-d\'Olonne, 85',
          source: 'Welcome to the Jungle',
        },
        {
          url: 'https://www.apec.fr/offres/alternance-gouvernance-si/offre-123.html',
          title: 'Alternant GRC / Gouvernance SI',
          company: 'OVHcloud',
          localisation: 'Saint-Herblain (44)',
          source: 'Apec',
        },
      ];

      testCases.forEach((tc, i) => {
        console.log(`--- Offre ${i + 1} ---`);
        console.log(`Titre      : ${tc.title}`);
        console.log(`Entreprise : ${tc.company}`);
        console.log(`Lieu       : ${tc.localisation}`);
        console.log(`Source     : ${tc.source}`);
        console.log(`URL brute  : ${tc.url}`);
        console.log(`URL propre : ${normalizeUrl(tc.url)}`);
        console.log(`ID unique  : ${computeUniqueId(tc.url)}`);
        console.log(`Alternance : ${isAlternance(tc.title) ? '✅' : '❌'}`);
        console.log(`Domaines   : ${detectDomains(tc.title).join(', ') || '(aucun)'}`);
        console.log(`Zone       : ${detectZone(tc.localisation) || '(non détectée)'}`);
        console.log('');
      });

      // Test doublon
      const url1 = 'https://www.francetravail.fr/offre/789?utm_source=a';
      const url2 = 'https://www.francetravail.fr/offre/789?utm_source=b';
      console.log('--- Test dédoublonnage ---');
      console.log(`URL 1 : ${url1}`);
      console.log(`URL 2 : ${url2}`);
      console.log(`ID URL 1 : ${computeUniqueId(url1)}`);
      console.log(`ID URL 2 : ${computeUniqueId(url2)}`);
      console.log(`Même ID ? : ${computeUniqueId(url1) === computeUniqueId(url2) ? '✅ OUI (doublon détecté)' : '❌ NON'}`);
      break;
    }

    default:
      printUsage();
      if (command) process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 4. EXPORTS (si utilisé comme module)
// ---------------------------------------------------------------------------

module.exports = {
  normalizeUrl,
  computeUniqueId,
  detectZone,
  detectDomains,
  isAlternance,
  buildNotionPayload,
  KEYWORDS,
  ALTERNANCE_KEYWORDS,
  ZONES,
  DEFAULT_RYTHME,
};

// Point d'entrée CLI
if (require.main === module) {
  runCli();
}
