# Veille offres d'alternance — Guide de mise en place V1

Ce guide te permet de reproduire **pas à pas** la mise en place de la veille automatique d'offres d'alternance :
- 2 zones géographiques : **Nantes +20 km** et **Les Sables-d'Olonne +20 km**
- Domaines : Réseau / Cyber / Supervision / Infrastructure / Gouvernance
- Base de données dans **Notion** (page dédiée)
- Scénario **Make (Integromat)** exécuté **1 fois par jour**
- Email récapitulatif quotidien vers **tessier.jonas38@gmail.com**

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Créer la structure Notion](#2-créer-la-structure-notion)
   - 2.1 [Nouvelle page](#21-nouvelle-page)
   - 2.2 [Base Entreprises](#22-base-entreprises)
   - 2.3 [Base Offres](#23-base-offres)
   - 2.4 [Créer les vues](#24-créer-les-vues)
3. [Créer l'intégration Notion (API token)](#3-créer-lintégration-notion-api-token)
4. [Récupérer les Database IDs](#4-récupérer-les-database-ids)
5. [Configurer le scénario Make](#5-configurer-le-scénario-make)
   - 5.1 [Vue d'ensemble du scénario](#51-vue-densemble-du-scénario)
   - 5.2 [Module 1 — Scheduler](#52-module-1--scheduler)
   - 5.3 [Modules 2-N — Collecte des offres](#53-modules-2-n--collecte-des-offres)
   - 5.4 [Module normalisation / mapping](#54-module-normalisation--mapping)
   - 5.5 [Module dédoublonnage](#55-module-dédoublonnage)
   - 5.6 [Module création Notion](#56-module-création-notion)
   - 5.7 [Module email récapitulatif](#57-module-email-récapitulatif)
6. [Stratégie de dédoublonnage](#6-stratégie-de-dédoublonnage)
7. [Variables à paramétrer](#7-variables-à-paramétrer)
8. [Sources surveillées](#8-sources-surveillées)
   - 8.1 [Job boards / agrégateurs](#81-job-boards--agrégateurs)
   - 8.2 [Sites carrières entreprises](#82-sites-carrières-entreprises)
9. [Mots-clés de matching](#9-mots-clés-de-matching)
10. [Troubleshooting](#10-troubleshooting)
11. [Évolutions possibles (V2)](#11-évolutions-possibles-v2)

---

## 1. Prérequis

| Outil | Usage | Gratuit ? |
|---|---|---|
| [Notion](https://notion.so) | Base de données des offres | ✅ (plan free suffisant) |
| [Make (Integromat)](https://make.com) | Automatisation quotidienne | ✅ (plan free : 1 000 ops/mois) |
| Compte email (Gmail, SMTP ou Make Email) | Envoi du récap quotidien | ✅ |
| Node.js (optionnel) | Script utilitaire de hash | ✅ |

> **Conseil** : Si tu dépasses 1 000 opérations/mois sur Make, passe au plan Core (~9 €/mois). Pour une veille modeste (50–100 offres/jour), le plan gratuit suffira en V1.

---

## 2. Créer la structure Notion

### 2.1 Nouvelle page

1. Dans Notion, clique sur **"+ Nouvelle page"** dans la barre latérale gauche.
2. Intitule-la : **`Alternance — Veille offres`**
3. Laisse le contenu vide pour l'instant.

---

### 2.2 Base Entreprises

Crée d'abord la base **Entreprises** (elle doit exister avant **Offres** pour créer la relation).

1. Dans la page, tape `/database` → sélectionne **"Database – Inline"** (ou Full page, au choix).
2. Nomme-la **`Entreprises`**.
3. Supprime la colonne "Tags" par défaut si elle est présente.
4. Ajoute les propriétés suivantes :

| Propriété | Type Notion |
|---|---|
| **Nom** | Title (déjà présent) |
| **Site** | URL |
| **Carrières / Jobs** | URL |
| **Localisation** | Text |
| **Notes** | Text |

> La relation inverse (colonne "Offres") sera créée automatiquement lors de la création de la relation dans la base Offres.

**Pré-remplir quelques entreprises (optionnel mais recommandé) :**
Voir la liste en section [8.2](#82-sites-carrières-entreprises).

---

### 2.3 Base Offres

1. Sous la base Entreprises (toujours dans la même page), ajoute une 2e **"Database – Inline"**.
2. Nomme-la **`Offres`**.
3. Supprime "Tags" si présent.
4. Crée les propriétés suivantes (dans cet ordre) :

| Propriété | Type Notion | Options / Remarques |
|---|---|---|
| **Intitulé** | Title | (déjà présent) |
| **Entreprise** | Relation | → Pointe vers la base **Entreprises** ; activer "Show on Entreprises" |
| **Statut** | Select | Valeurs : `À trier` `À contacter` `Candidature envoyée` `Entretien` `Refus` `Offre` |
| **Domaine** | Multi-select | Valeurs : `Réseau` `Cyber` `Supervision` `Infrastructure` `Gouvernance` |
| **Ville ciblée** | Select | Valeurs : `Nantes (+20 km)` `Les Sables-d'Olonne (+20 km)` |
| **Localisation** | Text | Ville/code postal brut extrait de l'offre |
| **Lien** | URL | URL directe vers l'offre |
| **Source** | Select | Valeurs : `Welcome to the Jungle` `LinkedIn Jobs` `Indeed` `Apec` `France Travail` `JobTeaser` `Site entreprise` |
| **Date de publication** | Date | Date de publication de l'offre (si disponible) |
| **Date d'import** | Date | Date d'ajout dans Notion (remplie par Make = `now`) |
| **Type** | Select | Valeurs : `Alternance` (seul type utilisé en V1) |
| **Rythme** | Text | Pré-rempli : `3 semaines entreprise / 1 semaine cours` |
| **ID unique** | Text | Hash SHA-256 du lien (clé de dédoublonnage) |
| **Mots-clés match** | Text | (optionnel) Mots-clés qui ont matché lors de l'import |

> **Ordre des options Statut** : l'ordre est important pour le kanban. Crée-les dans l'ordre ci-dessus : `À trier` en premier (couleur grise), puis les autres.

---

### 2.4 Créer les vues

Dans la base **Offres**, crée les vues suivantes :

#### Vue 1 — Kanban par Statut (pipeline)
1. Clique sur **"+ Ajouter une vue"** → **Board**.
2. Nomme-la **`Pipeline`** (ou `Kanban`).
3. Grouper par : **Statut**.
4. Trier les colonnes : `À trier` → `À contacter` → `Candidature envoyée` → `Entretien` → `Refus` → `Offre`.

#### Vue 2 — Table "Nouvelles (À trier)"
1. Ajoute une vue **Table**.
2. Nomme-la **`Nouvelles (À trier)`**.
3. Filtre : **Statut** `est` **À trier**.
4. Trier : **Date d'import** décroissant.

#### Vues optionnelles recommandées
- **Nantes** : Table filtrée sur `Ville ciblée = Nantes (+20 km)`
- **Sables** : Table filtrée sur `Ville ciblée = Les Sables-d'Olonne (+20 km)`
- **Dernières 7j** : Table filtrée sur `Date d'import` dans les 7 derniers jours

---

## 3. Créer l'intégration Notion (API token)

> Cette étape est nécessaire pour que Make puisse écrire dans tes bases.

1. Va sur [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Clique sur **"+ New integration"**.
3. Paramètres :
   - **Name** : `Make — Veille alternance`
   - **Associated workspace** : ton workspace personnel
   - **Type** : Internal
4. Clique sur **Submit**.
5. Copie le **"Internal Integration Token"** (commence par `secret_...`).  
   ⚠️ **Ne partage jamais ce token** — conserve-le dans un gestionnaire de mots de passe.

### Donner accès aux bases

Pour chaque base (Offres et Entreprises) :
1. Ouvre la base dans Notion.
2. Clique sur les **3 points** `...` en haut à droite → **"Add connections"** (ou "Connexions").
3. Recherche et sélectionne **"Make — Veille alternance"**.

> Sans cette étape, Make recevra une erreur 404 lors des appels API.

---

## 4. Récupérer les Database IDs

Chaque base Notion a un ID unique nécessaire pour les requêtes API de Make.

### Méthode simple (URL)
1. Ouvre la base **Offres** en plein écran (clique sur `↗` ou ouvre en nouvelle page).
2. Regarde l'URL dans le navigateur. Elle ressemble à :
   ```
   https://www.notion.so/VotreWorkspace/Offres-<DATABASE_ID>?v=...
   ```
   ou
   ```
   https://www.notion.so/<DATABASE_ID>?v=...
   ```
3. L'**ID de la base** est la partie de 32 caractères hexadécimaux.  
   Exemple : `a1b2c3d4e5f6789012345678901234ab`  
   (Avec tirets : `a1b2c3d4-e5f6-7890-1234-5678901234ab`)

4. Répète pour la base **Entreprises**.

### Méthode via l'API Notion (si l'URL n'est pas lisible)
```bash
curl -X POST https://api.notion.com/v1/search \
  -H "Authorization: Bearer secret_VOTRE_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"query": "Offres", "filter": {"value": "database", "property": "object"}}'
```
L'ID se trouve dans le champ `"id"` de la réponse JSON.

**Note les 2 IDs (tu en auras besoin dans Make) :**
```
DATABASE_ID_OFFRES     = ________________________________
DATABASE_ID_ENTREPRISES = ________________________________
```

---

## 5. Configurer le scénario Make

> Voir aussi : [`make-modules.md`](./make-modules.md) pour le détail complet de chaque module.

### 5.1 Vue d'ensemble du scénario

```
[Scheduler] ──► [Collecte source 1 (France Travail)]
              ──► [Collecte source 2 (Apec)]
              ──► [Collecte source 3 (WTTJ)]
              ──► [Collecte source 4 (JobTeaser)]
              ──► [Collecte sites entreprises]
                        │
                        ▼
              [Normalisation / Mapping]
                        │
                        ▼
              [Calcul ID unique (hash du lien)]
                        │
                        ▼
              [Recherche Notion — existe déjà ?]
                        │
                  ┌─────┴─────┐
                  │ NON       │ OUI
                  ▼           ▼
        [Créer dans Notion]  [Ignorer]
                  │
                  ▼
        [Accumuler nouvelles offres]
                  │
                  ▼
        [Email récapitulatif → tessier.jonas38@gmail.com]
```

### 5.2 Module 1 — Scheduler

1. Dans Make, crée un nouveau scénario.
2. Ajoute le module **"Scheduling"** (horloge).
3. Paramètres :
   - **Run scenario** : `At a regular interval`
   - **Interval** : `1 day`
   - **Start time** : `07:00` (ou l'heure de ton choix — voir section [7](#7-variables-à-paramétrer))
   - **Timezone** : `Europe/Paris`

### 5.3 Modules 2-N — Collecte des offres

Pour chaque source, ajoute un module de collecte. Voir [`make-modules.md`](./make-modules.md) pour la configuration complète de chaque source.

**Résumé des modules par source :**

| Source | Module Make | Type |
|---|---|---|
| France Travail | HTTP → GET (API officielle) | API REST |
| Apec | HTTP → GET (API officielle) | API REST |
| Welcome to the Jungle | HTTP → GET (flux RSS ou API) | RSS/API |
| JobTeaser | HTTP → GET (API partenaire) | API |
| Sites entreprises | HTTP → GET + Parser HTML | Scraping léger |
| LinkedIn Jobs | ⚠️ Non recommandé en V1 | Limité |
| Indeed | ⚠️ Non recommandé en V1 | Limité |

### 5.4 Module normalisation / mapping

Après chaque collecte, utilise le module **"Tools → Set Variable"** ou **"JSON → Create JSON"** pour normaliser les champs :

```json
{
  "intitule": "{{titre_extrait}}",
  "entreprise": "{{entreprise_extraite}}",
  "lien": "{{url_offre}}",
  "localisation": "{{ville_extraite}}",
  "source": "France Travail",
  "date_publication": "{{date_extraite}}",
  "domaine": "{{domaine_detecte}}",
  "ville_ciblee": "{{zone_detectee}}"
}
```

**Détection de zone** (via "Tools → Set Variable" avec condition) :
```
IF localisation CONTAINS "Nantes" OR localisation IN [communes_nantes_20km]
  THEN ville_ciblee = "Nantes (+20 km)"
ELSE IF localisation CONTAINS "Sables" OR localisation IN [communes_sables_20km]
  THEN ville_ciblee = "Les Sables-d'Olonne (+20 km)"
```

### 5.5 Module dédoublonnage

1. Ajoute le module **"Notion → Search Database Records"**.
2. Paramètres :
   - **Connection** : ta connexion Notion (avec le token créé en étape 3)
   - **Database ID** : `DATABASE_ID_OFFRES`
   - **Filter** :
     - Property : `ID unique`
     - Condition : `equals`
     - Value : `{{id_unique_calcule}}`
3. Branche ensuite un **"Router"** :
   - **Route 1** (si résultat vide = pas de doublon) → passer à la création
   - **Route 2** (si résultat non vide = doublon) → ignorer (`Stop` ou simplement ne rien faire)

### 5.6 Module création Notion

Module : **"Notion → Create a Database Item"**

| Champ Make | Valeur |
|---|---|
| Connection | ta connexion Notion |
| Database ID | `DATABASE_ID_OFFRES` |
| **Intitulé** (Title) | `{{intitule}}` |
| **Statut** | `À trier` (valeur fixe) |
| **Type** | `Alternance` (valeur fixe) |
| **Rythme** | `3 semaines entreprise / 1 semaine cours` (valeur fixe) |
| **Lien** | `{{lien}}` |
| **Source** | `{{source}}` |
| **Localisation** | `{{localisation}}` |
| **Ville ciblée** | `{{ville_ciblee}}` |
| **Domaine** | `{{domaine_detecte}}` |
| **Date de publication** | `{{date_publication}}` |
| **Date d'import** | `{{now}}` |
| **ID unique** | `{{id_unique}}` |
| **Mots-clés match** | `{{mots_cles_matches}}` |

> Pour la propriété **Entreprise** (relation) : si le nom de l'entreprise existe déjà dans la base Entreprises, utilise un module "Notion → Search Database Records" préalable pour récupérer l'ID de la page Entreprise et créer la relation. Sinon, crée une nouvelle entrée Entreprises en amont (ou laisse vide en V1).

### 5.7 Module email récapitulatif

Après le traitement de toutes les sources, ajoute un module **"Email → Send an Email"** (ou **"Gmail → Send an Email"**) :

| Champ | Valeur |
|---|---|
| To | `tessier.jonas38@gmail.com` |
| Subject | `[Veille Alternance] {{date_today}} — {{nb_nouvelles}} nouvelles offres` |
| Content Type | HTML |
| Body | Voir template ci-dessous |

**Template email HTML :**
```html
<h2>Veille Alternance — {{date_today}}</h2>
<p><strong>{{nb_nouvelles}} nouvelle(s) offre(s)</strong> ajoutée(s) dans Notion.</p>

<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#f0f0f0;">
    <th>Intitulé</th>
    <th>Entreprise</th>
    <th>Localisation</th>
    <th>Source</th>
    <th>Lien</th>
  </tr>
  {{#each offres}}
  <tr>
    <td>{{intitule}}</td>
    <td>{{entreprise}}</td>
    <td>{{localisation}}</td>
    <td>{{source}}</td>
    <td><a href="{{lien}}">Voir l'offre</a></td>
  </tr>
  {{/each}}
</table>

<p style="color:#888;font-size:12px;">
  Généré automatiquement par Make · 
  <a href="https://www.notion.so">Ouvrir Notion</a>
</p>
```

> Dans Make, accumule les offres créées avec le module **"Array aggregator"** ou **"Tools → Set variable"** dans une variable de liste, puis injecte-la dans le template email.

---

## 6. Stratégie de dédoublonnage

L'**ID unique** est un hash SHA-256 des 8 premiers caractères du lien de l'offre normalisé :

### Logique
1. Prendre l'URL complète de l'offre.
2. Normaliser : retirer les paramètres de tracking (`utm_*`, `ref=`, etc.).
3. Calculer le hash SHA-256 de l'URL normalisée.
4. Stocker les **16 premiers caractères hexadécimaux** (suffisant pour éviter les collisions en V1).

### Dans Make (sans script externe)
Make dispose du module **"Crypto → SHA256"** :
1. Module **"Crypto → Hash"**
   - Algorithm : `SHA256`
   - Value : `{{lien_normalise}}`
   - Output : `{{id_unique}}`

### Avec le script utilitaire
Voir [`../../scripts/utils_alternance.js`](../../scripts/utils_alternance.js) pour tester localement.

### En cas de doublon
- Make recherche dans Notion si un enregistrement avec cet `ID unique` existe déjà.
- Si oui : **ignore** (ne crée pas de doublon).
- Si non : **crée** l'enregistrement.

---

## 7. Variables à paramétrer

Voici toutes les variables que tu peux ajuster librement :

| Variable | Valeur V1 | Où changer |
|---|---|---|
| **Heure d'exécution quotidienne** | `07:00 Europe/Paris` | Module Scheduler dans Make |
| **Email destinataire** | `tessier.jonas38@gmail.com` | Module Email dans Make |
| **Zones géographiques** | Nantes +20 km, Les Sables-d'Olonne +20 km | Filtre de détection de zone dans Make |
| **Rayon en km** | 20 km | Paramètre de recherche API (selon source) |
| **Mots-clés domaines** | Voir section 9 | Variables Make ou configuration source |
| **Sources actives** | France Travail, Apec, WTTJ, JobTeaser, Sites entreprises | Modules Make (activer/désactiver) |
| **Statut par défaut** | `À trier` | Module "Create Database Item" dans Make |
| **Type par défaut** | `Alternance` | Module "Create Database Item" dans Make |
| **Rythme par défaut** | `3 semaines entreprise / 1 semaine cours` | Module "Create Database Item" dans Make |
| **Longueur de l'ID unique** | 16 caractères hex | Script ou module Crypto dans Make |

---

## 8. Sources surveillées

### 8.1 Job boards / agrégateurs

#### France Travail (anciennement Pôle Emploi)
- **API officielle** : [https://francetravail.io/data/api/offres-emploi](https://francetravail.io/data/api/offres-emploi)
- Inscription gratuite, clé API obtenue sur [francetravail.io](https://francetravail.io)
- Paramètres de recherche :
  ```
  typeContrat=E1  (alternance/contrat d'apprentissage)
  commune=44109    (Nantes = INSEE 44109)
  distance=20
  motsCles=réseau,cyber,supervision,infrastructure
  ```

#### Apec
- **API** : [https://www.apec.fr/cms/api/v1](https://www.apec.fr/cms/api/v1) (peut nécessiter exploration)
- Alternative : flux RSS par recherche → `https://www.apec.fr/recherche-offre.html#typeOffer=ALTERNANCE&...`
- Paramètre contrat : alternance

#### Welcome to the Jungle
- **Flux RSS** : `https://www.welcometothejungle.com/fr/jobs/feed?aroundQuery=Nantes&aroundRadius=20&contractType=APPRENTICESHIP`
- Remplacer `Nantes` par `Les+Sables-d%27Olonne` pour la 2e zone
- Module Make : **RSS → Watch RSS feed items** ou **HTTP → GET** + parse XML

#### JobTeaser
- **API partenaire** ou flux RSS selon accès
- URL de recherche : `https://www.jobteaser.com/fr/alternances?location=Nantes&radius=20`
- En V1 : HTTP GET + module **HTML/XML Parser**

#### LinkedIn Jobs ⚠️
- Pas d'API publique stable. Scraping violant les CGU.
- **Recommandation V1** : ignorer ou tenter via RSS non officiel :
  `https://www.linkedin.com/jobs/search/?keywords=alternance+réseau&location=Nantes`
- À n'utiliser qu'en connaissance de cause.

#### Indeed ⚠️
- Flux RSS disponible (mais instable) :
  `https://fr.indeed.com/rss?q=alternance+cyber&l=Nantes&radius=20`
- En V1 : tester le flux RSS avant d'intégrer.

---

### 8.2 Sites carrières entreprises

Liste initiale à saisir dans la base **Entreprises** de Notion :

| Entreprise | Page carrières |
|---|---|
| Naval Group | https://www.navalgroup.com/fr/nos-offres-emploi/ |
| Thales | https://www.thalesgroup.com/fr/global/activités/offres-emploi |
| Atos | https://atos.net/fr/carrieres |
| OVHcloud | https://www.ovhcloud.com/fr/jobs/ |
| BPCE | https://recrutement.bpce.fr/ |
| Capgemini | https://www.capgemini.com/fr-fr/carrieres/offres-d-emploi/ |
| TotalEnergies | https://jobs.totalenergies.com/fr_FR/ |
| E.Leclerc | https://recrutement.e-leclerc.com/ |
| UTech | https://www.utech.fr/recrutement (à vérifier) |
| Sopra Steria | https://www.soprasteria.com/fr/carrieres/offres |
| Sigma | https://www.sigma.fr/carrieres |
| Inetum | https://carrieres.inetum.com/ |
| La Fournée Dorée | https://www.lafourneedoree.fr/recrutement |
| PRB | https://www.prb.fr/recrutement/ |
| Ouest-France | https://recrutement.ouest-france.fr/ |
| Airbus | https://www.airbus.com/fr/carrieres |
| Safran | https://www.safran-group.com/fr/carrieres |
| Orange | https://recrutement.orange.fr/ |
| SFR | https://carrieres.sfr.fr/ |
| Bouygues Telecom | https://emploi.bouyguestelecom.fr/ |
| La Poste Groupe | https://laposterecrute.fr/ |
| SNCF | https://emploi.sncf.com/ |
| Enedis | https://recrutement.enedis.fr/ |
| EDF | https://recrutement.edf.com/ |
| Crédit Agricole | https://jobs.credit-agricole.fr/ |
| Société Générale | https://careers.societegenerale.com/fr/ |
| IBM | https://www.ibm.com/fr-fr/employment/ |
| Cisco | https://jobs.cisco.com/ |
| Stormshield | https://www.stormshield.com/fr/carrieres/ |
| Claroty | *(international, scraping limité)* |

> **Comment surveiller ces pages dans Make** :
> 1. Module **HTTP → GET** sur l'URL de la page carrières.
> 2. Module **HTML/CSS Selector** ou **Text Parser (Regex)** pour extraire les offres.
> 3. Filtrer sur mots-clés et zone géographique.
>
> Certaines pages peuvent changer de structure → vérification mensuelle recommandée.

---

## 9. Mots-clés de matching

Ces mots-clés sont utilisés pour filtrer les offres pertinentes. Applique-les en filtre "contains" (insensible à la casse) sur le titre et/ou la description de l'offre.

### Réseau
```
réseau, network, cisco, routing, switching, lan, wan, tcp/ip, bgp, ospf, vlan,
firewall, vpn, mpls, sd-wan, wifi, wi-fi, sans fil, nat, dns, dhcp, proxy
```

### Cyber / Cybersécurité
```
cyber, cybersécurité, sécurité informatique, soc, siem, edr, xdr, iam, pentest,
test d'intrusion, iso 27001, vulnerability, forensic, blue team, red team,
threat intelligence, rssi, ssi, pssi, pare-feu, antivirus, endpoint
```

### Supervision
```
supervision, monitoring, observabilité, observability, zabbix, nagios, grafana,
prometheus, splunk, datadog, centreon, alerting, noc, performance
```

### Infrastructure
```
infrastructure, infra, systèmes, linux, windows server, vmware, vsphere, 
hyper-v, cloud, aws, azure, gcp, kubernetes, docker, devops, ansible,
terraform, virtualisation, stockage, sauvegarde, backup
```

### Gouvernance
```
gouvernance, grc, conformité, risques, risk management, rssi, pssi, iso 27001,
iso 27005, ebios, dpo, rgpd, gdpr, audit, contrôle, politique de sécurité
```

### Mots-clés "alternance"
Toujours vérifier que l'offre contient au moins un de ces termes :
```
alternance, apprentissage, contrat d'apprentissage, contrat de professionnalisation,
en alternance, apprenti, apprentie
```

---

## 10. Troubleshooting

### ❌ Make reçoit une erreur 401 ou 403 de l'API Notion
**Cause** : Token Notion invalide ou integration non connectée à la base.  
**Solution** :
1. Vérifie que le token commence par `secret_`.
2. Vérifie que l'intégration a bien été ajoutée à **chaque** base (Offres ET Entreprises).
3. Régénère le token si nécessaire depuis [notion.so/my-integrations](https://notion.so/my-integrations).

### ❌ Make reçoit une erreur 404 "database not found"
**Cause** : Database ID incorrect.  
**Solution** :
1. Récupère l'ID directement depuis l'URL Notion (voir section 4).
2. L'ID doit contenir 32 caractères hexadécimaux (sans tirets) ou 36 avec tirets.
3. Dans Make, le champ "Database ID" accepte les deux formats.

### ❌ Des doublons apparaissent dans Notion
**Cause** : Le hash de l'ID unique n'est pas calculé correctement, ou l'URL varie (paramètres tracking).  
**Solution** :
1. Normalise l'URL avant le hash : retire les paramètres `?utm_*`, `&ref=`, `&source=`, etc.
2. Utilise le script `scripts/utils_alternance.js` pour tester le hash localement.
3. Vérifie que le filtre Notion dans Make recherche bien sur la propriété `ID unique`.

### ❌ Aucune offre n'est collectée depuis France Travail / Apec
**Cause** : Clé API non valide ou paramètres de recherche incorrects.  
**Solution** :
1. France Travail : vérifier le token d'accès sur [francetravail.io](https://francetravail.io) (token OAuth2, expire).
2. Apec : tester l'URL de recherche directement dans le navigateur.
3. Vérifier le code INSEE de la commune (Nantes = `44109`, Les Sables-d'Olonne = `85194`).

### ❌ L'email quotidien n'arrive pas
**Cause** : Module email mal configuré ou bloqué.  
**Solution** :
1. Tester le module email Make manuellement (bouton "Run once").
2. Si Gmail : autoriser "Less secure apps" ou utiliser OAuth2 (recommandé).
3. Vérifier les spams.
4. Alternative : utiliser le module **"Make → Send an Email"** natif (plus simple).

### ❌ Le scénario consomme trop d'opérations Make
**Cause** : Trop de modules ou d'itérations.  
**Solution** :
1. Regrouper les sources dans un seul module HTTP si possible.
2. Limiter le nombre d'offres par source (ex: 50 max).
3. Passer au plan Make Core si nécessaire.

### ❌ Les sites carrières ne sont plus parsables
**Cause** : Le site a changé sa structure HTML.  
**Solution** :
1. Inspecter la nouvelle structure avec les outils développeur du navigateur.
2. Mettre à jour le sélecteur CSS ou la regex dans Make.
3. Vérification mensuelle recommandée.

### ❌ Notion refuse la valeur d'un Select
**Cause** : La valeur envoyée par Make ne correspond pas exactement à une option existante.  
**Solution** :
1. Les valeurs Select sont sensibles à la casse et aux espaces.
2. S'assurer que les valeurs dans Make correspondent exactement aux options créées dans Notion (ex: `À trier` et non `a trier`).

---

## 11. Évolutions possibles (V2)

- **Alertes Telegram/Discord** en temps réel (en plus de l'email quotidien)
- **Score de pertinence** automatique (0–10) basé sur les mots-clés matchés
- **Vue statistiques** Notion : nb d'offres par source, par domaine, par semaine
- **Relance automatique** : si une offre est en statut "À contacter" depuis 7 jours, envoi d'un rappel email
- **LinkedIn via RapidAPI** : intégration payante mais stable
- **Export CSV** hebdomadaire automatique
- **Ajout de la zone** : Saint-Nazaire, La Roche-sur-Yon, etc.

---

*Document créé pour le projet [`jonastsr1/calculateur_placo`](https://github.com/jonastsr1/calculateur_placo) — Veille alternance V1*
