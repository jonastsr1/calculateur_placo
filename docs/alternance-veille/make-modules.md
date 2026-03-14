# Make — Détail des modules du scénario

Ce fichier décrit en détail chaque module du scénario Make pour la veille d'offres d'alternance.

> **Prérequis** : avoir lu le [guide principal](./README.md) et préparé les éléments suivants :
> - Token d'intégration Notion (`secret_...`)
> - `DATABASE_ID_OFFRES` et `DATABASE_ID_ENTREPRISES`
> - Compte Make avec connexion Notion configurée

---

## Structure globale du scénario

```
Module 1  : Scheduler (quotidien 07:00)
              │
              ├── Module 2  : Collecte France Travail
              ├── Module 3  : Collecte Apec
              ├── Module 4  : Collecte Welcome to the Jungle
              ├── Module 5  : Collecte JobTeaser
              └── Module 6  : Collecte sites entreprises (iterator)
                        │
              Module 7  : Normalisation (Set Variables)
                        │
              Module 8  : Calcul ID unique (Crypto SHA256)
                        │
              Module 9  : Recherche doublon Notion
                        │
              Module 10 : Router
                   ├── Route A (pas de doublon) → Module 11 : Créer entrée Notion
                   └── Route B (doublon) → Stop
                        │
              Module 12 : Array Aggregator (accumule les nouvelles offres)
                        │
              Module 13 : Email récapitulatif
```

---

## Module 1 — Scheduler

**App** : `Scheduling`  
**Action** : Schedule a scenario

| Paramètre | Valeur |
|---|---|
| Run scenario | `At a regular interval` |
| Interval | `Days` → `1` |
| Time | `07:00` |
| Timezone | `Europe/Paris` |
| Days of week | Tous les jours (ou du lundi au vendredi selon préférence) |

---

## Module 2 — Collecte France Travail

**App** : `HTTP`  
**Action** : Make a request

> France Travail propose une API officielle gratuite. Créer un compte sur [francetravail.io](https://francetravail.io) et créer une application pour obtenir `client_id` et `client_secret`.

### Étape 2a — Obtenir le token OAuth2

**App** : `HTTP → Make a request`

| Paramètre | Valeur |
|---|---|
| URL | `https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire` |
| Method | `POST` |
| Body type | `Application/x-www-form-urlencoded` |
| Fields | `grant_type=client_credentials` |
|  | `client_id={{FT_CLIENT_ID}}` |
|  | `client_secret={{FT_CLIENT_SECRET}}` |
|  | `scope=api_offresdemploiv2 o2dsoffre` |

Récupère le champ `access_token` de la réponse pour les appels suivants.

### Étape 2b — Recherche des offres (Nantes)

**App** : `HTTP → Make a request`

| Paramètre | Valeur |
|---|---|
| URL | `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search` |
| Method | `GET` |
| Headers | `Authorization: Bearer {{access_token}}` |
| Query params | `typeContrat=E1` (apprentissage) |
|  | `commune=44109` (code INSEE Nantes) |
|  | `distance=20` |
|  | `motsCles=réseau cyber supervision infrastructure gouvernance` |
|  | `range=0-49` (50 premières offres) |

**Résultat** : tableau `resultats[]` avec les offres.

Répéter avec `commune=85194` (Les Sables-d'Olonne) pour la 2e zone.

### Mapping des champs France Travail → Notion

| Champ Notion | Champ API France Travail |
|---|---|
| Intitulé | `intitule` |
| Entreprise | `entreprise.nom` |
| Lien | `origineOffre.urlOrigine` |
| Localisation | `lieuTravail.libelle` |
| Date de publication | `dateCreation` |
| Source | `"France Travail"` (valeur fixe) |

---

## Module 3 — Collecte Apec

**App** : `HTTP → Make a request`

L'Apec dispose d'une API non documentée publiquement mais accessible via les URLs de recherche.

| Paramètre | Valeur |
|---|---|
| URL | `https://www.apec.fr/api/v1/jobs/search` |
| Method | `POST` |
| Headers | `Content-Type: application/json` |
| Body (JSON) | Voir ci-dessous |

```json
{
  "typeWorkplace": ["ALTERNANCE"],
  "keywords": "réseau cyber supervision infrastructure",
  "locations": [
    {"code": "44", "label": "Loire-Atlantique"},
    {"code": "85", "label": "Vendée"}
  ],
  "nbItemsPerPage": 50,
  "page": 1
}
```

> ⚠️ L'API Apec peut changer. Alternative fiable : utiliser le **flux RSS** de recherche Apec :
> ```
> https://www.apec.fr/recherche-offre.html?typeOffer=ALTERNANCE&location=Nantes&radius=20#/
> ```
> Puis module **HTML Parser** pour extraire les offres.

### Mapping Apec → Notion

| Champ Notion | Champ Apec |
|---|---|
| Intitulé | `title` |
| Entreprise | `company.name` |
| Lien | `applyUrl` ou URL construite |
| Localisation | `location.label` |
| Date de publication | `publicationDate` |
| Source | `"Apec"` (valeur fixe) |

---

## Module 4 — Collecte Welcome to the Jungle

**App** : `RSS → Watch RSS feed items`  
(ou `HTTP → Make a request` si le flux RSS n'est pas direct)

### Flux RSS — Nantes
```
https://www.welcometothejungle.com/fr/jobs/feed?
  aroundQuery=Nantes%2C+France
  &aroundRadius=20
  &contractType=APPRENTICESHIP
  &query=réseau+cyber+supervision
```

### Flux RSS — Les Sables-d'Olonne
```
https://www.welcometothejungle.com/fr/jobs/feed?
  aroundQuery=Les+Sables-d%27Olonne%2C+France
  &aroundRadius=20
  &contractType=APPRENTICESHIP
  &query=réseau+cyber+supervision
```

**Module Make** : `RSS → Watch RSS feed items`

| Paramètre | Valeur |
|---|---|
| Feed URL | URL ci-dessus |
| Maximum number of items | `50` |

### Mapping WTTJ → Notion

| Champ Notion | Champ RSS |
|---|---|
| Intitulé | `title` |
| Entreprise | `author` ou extrait du `title` |
| Lien | `link` |
| Localisation | Extrait de `description` (regex) |
| Date de publication | `pubDate` |
| Source | `"Welcome to the Jungle"` (valeur fixe) |

---

## Module 5 — Collecte JobTeaser

**App** : `HTTP → Make a request`

JobTeaser propose une API pour les entreprises partenaires. Pour un usage individuel, on peut utiliser la recherche publique.

| Paramètre | Valeur |
|---|---|
| URL | `https://www.jobteaser.com/fr/api/v1/offers` |
| Method | `GET` |
| Query params | `contract_type=apprenticeship` |
|  | `location=Nantes` |
|  | `radius=20` |
|  | `q=réseau cyber` |

> Alternative : HTTP GET sur `https://www.jobteaser.com/fr/alternances?location=Nantes` suivi d'un **HTML parser** pour extraire les offres.

### Mapping JobTeaser → Notion

| Champ Notion | Champ JobTeaser |
|---|---|
| Intitulé | `title` |
| Entreprise | `company.name` |
| Lien | `url` |
| Localisation | `location.city` |
| Date de publication | `publishedAt` |
| Source | `"JobTeaser"` (valeur fixe) |

---

## Module 6 — Collecte sites entreprises

Cette section gère la surveillance des pages carrières des entreprises listées dans la base Entreprises de Notion.

### Étape 6a — Lire la liste des entreprises depuis Notion

**App** : `Notion → Get Database Items`

| Paramètre | Valeur |
|---|---|
| Connection | ta connexion Notion |
| Database ID | `DATABASE_ID_ENTREPRISES` |
| Filter | *(aucun — récupérer toutes les entreprises)* |

### Étape 6b — Itérer sur chaque entreprise

**App** : `Tools → Iterator`  
Itère sur le tableau de résultats de l'étape 6a.

### Étape 6c — GET sur la page carrières

Pour chaque entreprise :

**App** : `HTTP → Make a request`

| Paramètre | Valeur |
|---|---|
| URL | `{{Carrières/Jobs}}` (URL de la propriété Notion) |
| Method | `GET` |
| Follow Redirect | `Yes` |

### Étape 6d — Parser le HTML

**App** : `Tools → Text Parser` (regex) ou `HTML/CSS Selector`

Exemple de regex pour extraire des liens d'offres :
```regex
href="([^"]*(?:alternance|apprentissage|alternant)[^"]*)"
```

> La regex varie selon le site. Il faudra peut-être ajuster pour chaque entreprise.

### Étape 6e — Normaliser et mapper
Même logique que les autres sources. Source = `"Site entreprise"`.

---

## Module 7 — Normalisation (Set Variables)

**App** : `Tools → Set Variable` (répété pour chaque champ)

Utilise un **Set Multiple Variables** pour préparer les données normalisées :

| Variable | Expression |
|---|---|
| `lien_normalise` | `{{replace(lien; "/\?utm_[^&]*(&\|$)/g"; "")}}` |
| `titre_propre` | `{{trim(intitule)}}` |
| `entreprise_propre` | `{{trim(entreprise)}}` |
| `source_propre` | `{{source}}` |
| `date_pub` | `{{if(date_publication; formatDate(date_publication; "YYYY-MM-DD"); "")}}` |

### Détection de zone géographique

**App** : `Tools → Set Variable`

```
ville_ciblee = 
  IF contains(lower(localisation), "nantes") 
     OR contains(lower(localisation), "saint-nazaire")
     OR contains(lower(localisation), "rezé")
     OR contains(lower(localisation), "orvault")
     OR contains(lower(localisation), "saint-herblain")
     OR contains(lower(localisation), "vertou")
     OR contains(lower(localisation), "carquefou")
  THEN "Nantes (+20 km)"
  ELSE IF contains(lower(localisation), "sables")
     OR contains(lower(localisation), "sable")
     OR contains(lower(localisation), "olonne")
     OR contains(lower(localisation), "château-d'olonne")
     OR contains(lower(localisation), "talmont")
  THEN "Les Sables-d'Olonne (+20 km)"
  ELSE ""
```

> Si `ville_ciblee` est vide, l'offre ne correspond à aucune zone → utilise un filtre pour ignorer ces offres.

### Détection du domaine

```
domaine =
  IF any_of(titre+description, ["réseau","network","cisco","routing","switching","lan","wan","tcp","vpn","firewall"])
  THEN inclure "Réseau"
  
  IF any_of(titre+description, ["cyber","soc","siem","edr","pentest","iam","iso 27001","blue team"])
  THEN inclure "Cyber"
  
  IF any_of(titre+description, ["supervision","monitoring","zabbix","nagios","grafana","centreon"])
  THEN inclure "Supervision"
  
  IF any_of(titre+description, ["infrastructure","linux","vmware","azure","aws","cloud","docker"])
  THEN inclure "Infrastructure"
  
  IF any_of(titre+description, ["gouvernance","grc","conformité","rssi","pssi","rgpd","audit"])
  THEN inclure "Gouvernance"
```

Dans Make, utilise des modules **Set Variable** chaînés ou un module **Tools → Compose** avec des conditions `if`.

---

## Module 8 — Calcul de l'ID unique

**App** : `Crypto → Create a Hash`

| Paramètre | Valeur |
|---|---|
| Algorithm | `SHA256` |
| Value | `{{lien_normalise}}` |
| Encoding | `hex` |

Stocke le résultat dans la variable `id_unique`.

> Tu peux aussi ne prendre que les 16 premiers caractères : `{{substring(hash_result; 0; 16)}}`.

---

## Module 9 — Recherche doublon dans Notion

**App** : `Notion → Search Database Records`

| Paramètre | Valeur |
|---|---|
| Connection | ta connexion Notion |
| Database ID | `DATABASE_ID_OFFRES` |
| Filter property | `ID unique` |
| Filter condition | `equals` |
| Filter value | `{{id_unique}}` |

**Résultat attendu** :
- Si `Total count = 0` → pas de doublon → continuer
- Si `Total count > 0` → doublon → ignorer

---

## Module 10 — Router

**App** : `Router` (fourche/branchement)

Configure 2 routes :

**Route A** (nouvelle offre) :
- Condition : `{{9.total}} = 0`  
  *(total = 0 résultat dans la recherche Notion du module 9)*
- Destination : Module 11 (créer dans Notion)

**Route B** (doublon) :
- Condition : `{{9.total}} > 0`
- Destination : rien (ou module `Stop`)

---

## Module 11 — Créer l'entrée dans Notion

**App** : `Notion → Create a Database Item`

| Champ Make | Valeur |
|---|---|
| Connection | ta connexion Notion |
| Database ID | `DATABASE_ID_OFFRES` |
| **Intitulé** *(Title)* | `{{titre_propre}}` |
| **Statut** *(Select)* | `À trier` |
| **Type** *(Select)* | `Alternance` |
| **Rythme** *(Text)* | `3 semaines entreprise / 1 semaine cours` |
| **Lien** *(URL)* | `{{lien_normalise}}` |
| **Source** *(Select)* | `{{source_propre}}` |
| **Localisation** *(Text)* | `{{localisation}}` |
| **Ville ciblée** *(Select)* | `{{ville_ciblee}}` |
| **Domaine** *(Multi-select)* | `{{domaine}}` *(tableau de valeurs)* |
| **Date de publication** *(Date)* | `{{date_pub}}` |
| **Date d'import** *(Date)* | `{{now}}` |
| **ID unique** *(Text)* | `{{id_unique}}` |
| **Mots-clés match** *(Text)* | `{{mots_cles_matches}}` |

> **Note pour la propriété Entreprise (Relation)** :
> En V1, tu peux laisser cette propriété vide et la remplir manuellement.
> Pour l'automatiser : ajouter un module `Notion → Search Database Records` sur `DATABASE_ID_ENTREPRISES` par le nom de l'entreprise, et utiliser l'ID de la page trouvée dans le champ Relation.

---

## Module 12 — Array Aggregator

**App** : `Tools → Array aggregator`

Accumule toutes les offres créées (module 11) dans un tableau pour l'email.

| Paramètre | Valeur |
|---|---|
| Source module | Module 11 (Créer dans Notion) |
| Aggregated fields | `titre_propre`, `entreprise_propre`, `localisation`, `source_propre`, `lien_normalise` |

---

## Module 13 — Email récapitulatif

**App** : `Email → Send an Email` ou `Gmail → Send an Email`

| Paramètre | Valeur |
|---|---|
| To | `tessier.jonas38@gmail.com` |
| Subject | `[Veille Alternance] {{formatDate(now; "DD/MM/YYYY")}} — {{length(12.array)}} nouvelles offres` |
| Content Type | `HTML` |
| Body | Template HTML ci-dessous |

### Template HTML du corps de l'email

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: auto; }
    h2 { color: #2c5282; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th { background: #2c5282; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f7fafc; }
    a { color: #2b6cb0; }
    .footer { margin-top: 24px; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <h2>🔍 Veille Alternance — {{formatDate(now; "DD/MM/YYYY")}}</h2>
  <p>
    <strong>{{length(12.array)}} nouvelle(s) offre(s)</strong> ajoutée(s) dans Notion aujourd'hui.
  </p>

  <table>
    <thead>
      <tr>
        <th>Intitulé</th>
        <th>Entreprise</th>
        <th>Localisation</th>
        <th>Source</th>
        <th>Lien</th>
      </tr>
    </thead>
    <tbody>
      {{#each 12.array}}
      <tr>
        <td>{{titre_propre}}</td>
        <td>{{entreprise_propre}}</td>
        <td>{{localisation}}</td>
        <td>{{source_propre}}</td>
        <td><a href="{{lien_normalise}}">Voir l'offre →</a></td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="footer">
    <p>
      Généré automatiquement par Make (Integromat) · 
      <a href="https://www.notion.so">Ouvrir Notion</a>
    </p>
    <p>Pour modifier les critères de recherche, 
       consulter le <a href="https://github.com/jonastsr1/calculateur_placo/tree/main/docs/alternance-veille">guide de mise en place</a>.
    </p>
  </div>
</body>
</html>
```

> **Si aucune nouvelle offre** : ajoute un filtre avant le module email pour n'envoyer l'email que si `length(12.array) > 0`. Sinon, le module s'exécute mais envoie un email vide.

---

## Connexion Notion dans Make

La première fois, tu dois configurer la connexion Notion :

1. Dans n'importe quel module Notion, clique sur **"Create a connection"**.
2. Choisis **"Notion (API Token)"** (pas OAuth).
3. Colle ton `Internal Integration Token` (`secret_...`).
4. Nomme la connexion : `Notion Veille Alternance`.
5. Clique sur **"Save"**.

Cette connexion sera réutilisée dans tous les modules Notion du scénario.

---

## Variables Make recommandées (Data Stores)

Pour stocker les paramètres configurables sans modifier le scénario :

1. Dans Make, va dans **"Data stores"** → créer un data store `Config Veille`.
2. Schéma :
   ```json
   {
     "ft_client_id": "string",
     "ft_client_secret": "string",
     "notion_token": "string",
     "db_offres_id": "string",
     "db_entreprises_id": "string",
     "email_destinataire": "string",
     "heure_execution": "string",
     "mots_cles": "string"
   }
   ```
3. Au démarrage du scénario, ajoute un module **"Data Store → Get a Record"** pour charger ces valeurs.

Alternativement, utilise les **Variables globales Make** (menu Scenario → Variables).

---

*Document créé pour le projet [`jonastsr1/calculateur_placo`](https://github.com/jonastsr1/calculateur_placo) — Veille alternance V1*
