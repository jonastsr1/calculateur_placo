# calculateur_placo

Calculateur de plaques de plâtre (Placo®).

---

## 📋 Veille offres d'alternance — Notion + Make

Ce dépôt contient également la documentation et les scripts pour mettre en place une **veille automatique d'offres d'alternance** (Informatique réseau / Cyber / Supervision / Infrastructure / Gouvernance) dans **Nantes +20 km** et **Les Sables-d'Olonne +20 km**, avec injection dans **Notion** et email quotidien récapitulatif.

### Documentation

| Fichier | Description |
|---|---|
| [`docs/alternance-veille/README.md`](docs/alternance-veille/README.md) | Guide complet pas-à-pas : Notion, Make, dédoublonnage, troubleshooting |
| [`docs/alternance-veille/make-modules.md`](docs/alternance-veille/make-modules.md) | Détail de chaque module Make (Scheduler, collecte, mapping, email) |
| [`scripts/utils_alternance.js`](scripts/utils_alternance.js) | Script Node.js : calcul ID unique, détection zone/domaine, payload Notion |

### Démarrage rapide

```bash
# Tester le script utilitaire (Node.js requis)
node scripts/utils_alternance.js demo

# Calculer l'ID unique d'une URL
node scripts/utils_alternance.js hash "https://www.francetravail.fr/offre/123"

# Tester le matching d'un titre d'offre
node scripts/utils_alternance.js match "Alternant ingénieur réseau et cybersécurité Nantes"
```

Voir le [guide complet](docs/alternance-veille/README.md) pour les instructions détaillées.