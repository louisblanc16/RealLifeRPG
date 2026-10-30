# REAL LIFE RPG

Application sportive RPG locale, version 1.0.0. Une seule interface React, utilisable sur le web et dans Tauri 2 ; aucun serveur, compte ou accès Internet nécessaire en production. Polices, icônes et ressources sont embarquées.

## Développement et distribution

Prérequis : Node.js 22.12+, npm, Rust stable à jour. Windows : outils C++ Visual Studio et SDK Windows ; macOS : Xcode Command Line Tools, macOS 13.3+.

```sh
npm ci
npm run dev                     # web, port 5173 conservé
npm run desktop:dev             # Tauri, données de développement séparées
npm run build                   # TypeScript et Vite
npm run desktop:build:windows    # Windows x64, NSIS -setup.exe
```

Installateur : `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/REAL LIFE RPG_1.0.0_x64-setup.exe`. Le runtime WebView2 est inclus dans l’installateur hors ligne ; sa taille est donc supérieure à celle de l’application seule. Les premières compilations téléchargent les dépendances et les outils nécessaires.

Sur un Mac, depuis le même projet : `npm ci`, puis `npm run desktop:build` pour produire `.app` et `.dmg` pour l’architecture du Mac. La configuration macOS applique une signature ad hoc. Aucune compilation macOS depuis Windows et aucun mécanisme de mise à jour automatique.

## DMG macOS avec GitHub Actions

Le workflow [macos.yml](.github/workflows/macos.yml) se lance **uniquement à la demande**. Il compile nativement sur `macos-15` (Apple Silicon, `aarch64-apple-darwin`) et `macos-15-intel` (Intel, `x86_64-apple-darwin`), avec Node.js 24, Rust stable et les versions Tauri déjà verrouillées dans le projet. Il vérifie l’architecture, l’identifiant et la signature du bundle, puis conserve un DMG par architecture pendant **30 jours**. Aucun certificat Apple ou secret personnel n’est nécessaire pour ce mode.

1. Créer sur GitHub un dépôt **privé** vide, ou utiliser votre dépôt existant. Y envoyer les sources, y compris `.github`, `package-lock.json`, `src-tauri/Cargo.lock`, les icônes et les configurations de production. Respecter [.gitignore](.gitignore) : aucun `node_modules`, `target`, `.env`, certificat ou export personnel. Avec Git, contrôler les fichiers préparés avant le commit ; un téléversement manuel sur le site ne filtre pas automatiquement les fichiers ignorés. Ne pas réinitialiser un dépôt Git existant ni forcer le push.
2. Le workflow doit être présent sur la branche par défaut. Dans **Actions → macOS — DMG → Run workflow**, choisir la branche à compiler et laisser `prepare_release` décoché pour un premier essai. Si Actions demande une activation, l’autoriser dans les paramètres du dépôt. Les runners macOS d’un dépôt privé consomment le quota GitHub Actions du compte.
3. Après réussite des deux jobs, ouvrir l’exécution et télécharger les artefacts **macos-apple-silicon** et **macos-intel**. Décompresser le ZIP adapté : `REAL-LIFE-RPG_1.0.0_macos_apple-silicon.dmg` pour les Mac M1/M2/M3/M4 et suivants, ou `REAL-LIFE-RPG_1.0.0_macos_intel.dmg` pour Intel. macOS **13.3 minimum**. Le lien de l’exécution permet de retrouver les artefacts ; leur téléchargement demande une connexion GitHub et l’accès au dépôt privé.
4. Pour préparer un lien de distribution durable, relancer manuellement en cochant **prepare_release**. Après réussite des deux builds, un job distinct crée une **Release brouillon** `v1.0.0` avec les deux DMG. Il refuse tout tag ou Release déjà existant ; il n’écrase aucun fichier publié. En cas d’échec partiel de préparation, supprimer seulement le brouillon incomplet dans GitHub avant de réessayer. Aucun build ne publie une Release.
5. Tester d’abord l’artefact sur le Mac : ouverture, ressources hors ligne, export/import JSON (dont une ancienne sauvegarde), fermeture/réouverture et conservation de la progression après remplacement de l’application dans Applications. Ensuite, et seulement si vous l’approuvez, ouvrir **Releases → brouillon → Edit → Publish release** et partager le lien de la Release ou du DMG. Un brouillon reste réservé aux personnes pouvant gérer les Releases ; dans un dépôt privé, votre ami doit avoir accès au dépôt même après publication. Ne rendre le dépôt public que sur décision explicite.

Pour une mise à jour, augmenter ensemble les versions de `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` et `src-tauri/tauri.conf.json`, puis répéter ce processus. **Ne jamais changer `com.realliferpg.app`, le label `main` ou l’origine WebView.** Remplacer le bundle ne supprime pas le profil IndexedDB de l’utilisateur. Le workflow ne lit ni n’embarque de profil local ; il refuse les exports JSON REAL LIFE RPG versionnés, même renommés. Ces contrôles ne remplacent pas la revue des fichiers avant leur envoi sur GitHub.

### Signature et limites d’installation

La signature **ad hoc** (`signingIdentity: "-"` dans [tauri.macos.conf.json](src-tauri/tauri.macos.conf.json)) répond à l’exigence technique de signature Apple Silicon, mais **ne remplace ni Developer ID ni la notarisation Apple**. Gatekeeper peut bloquer l’application téléchargée ; l’installation sans avertissement n’est pas garantie. Le projet ne désactive ni ne contourne Gatekeeper.

Une future distribution officielle pourra ajouter les certificats et identifiants Apple dans **Settings → Secrets and variables → Actions**, puis fournir `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` et les identifiants de notarisation uniquement à l’étape Tauri, selon le [guide officiel de signature](https://v2.tauri.app/distribute/sign/macos/). Le remplacement de la signature conserve l’identifiant et les données ; aucune migration Dexie n’est nécessaire. Ne jamais versionner ces secrets. Références : [pipeline Tauri](https://v2.tauri.app/distribute/pipelines/github/), [tauri-action](https://github.com/tauri-apps/tauri-action), [runners GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Contrat de persistance des mises à jour

- Identifiant de production **immuable** : `com.realliferpg.app`. Conserver le nom, le mode NSIS `currentUser`, le label `main`, `useHttpsScheme: true` et le nom Dexie `real-life-rpg`. Sur Windows, l’origine de production est `https://tauri.localhost` ; sur macOS, `tauri://localhost`. Le routage desktop par fragment conserve cette origine même lors d’un rechargement.
- Windows : WebView2 conserve IndexedDB dans le profil utilisateur `%LOCALAPPDATA%\com.realliferpg.app\EBWebView`, hors du dossier d’installation. macOS : WKWebView utilise son magasin persistant par application dans la bibliothèque de l’utilisateur, géré par WebKit. Aucun mode privé, effacement au démarrage ou dossier de données embarqué.
- Remplacer ou réinstaller l’application avec la même identité et le même utilisateur conserve ce profil. Les scripts ne suppriment aucun dossier utilisateur. L’installateur NSIS standard protège les données en mode mise à jour ; lors d’une désinstallation explicite, ne pas cocher la suppression des données si vous souhaitez les garder. Deux copies portant la même identité pour le même utilisateur partagent logiquement les données ; navigateurs web, autres comptes système et identité de développement restent distincts.
- Conserver les migrations Dexie v1 à v4 ; toute évolution ajoute une version non destructive. La version applicative et le format JSON sont indépendants du numéro de schéma. Les sauvegardes JSON de schémas 1 à 4 restent importables.
- Les données ne sont pas synchronisées entre appareils. Une suppression du profil système/WebView, une désinstallation avec effacement, une panne disque ou une réinitialisation volontaire peuvent les détruire : conserver des exports JSON externes. Le stockage interne de la WebView n’est pas un format de transfert.

Références : [identité et origine WebView](https://v2.tauri.app/reference/config/#usehttpsscheme), [stockage local Tauri](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html#method.app_local_data_dir), [installation Windows hors ligne](https://v2.tauri.app/distribute/windows-installer/#offline-installer).

## Transfert web → bureau et contrôles manuels

1. Ouvrir la V1 web à son adresse et port habituels, puis **Paramètres → Exporter mes données**. La base du navigateur n’est pas partagée avec Tauri.
2. Dans l’application de bureau vierge, importer ce JSON et confirmer. Le format, les relations et les conflits sont vérifiés ; une sauvegarde de l’état antérieur est enregistrée avant toute écriture. Annuler ou faire échouer cet enregistrement annule l’import.
3. Fermer puis rouvrir l’application, vérifier le personnage, les historiques et les préférences. À la prochaine version, installer par-dessus sans supprimer les données et refaire ce contrôle.

La double confirmation **RÉINITIALISER** vide uniquement les tables Dexie de l’origine courante et recrée le profil initial. Elle n’efface ni les exports JSON externes, ni le navigateur web, ni les données d’autres utilisateurs système.

L’export desktop utilise une boîte de dialogue native et une écriture par remplacement atomique. La capacité native unique est limitée à cet export ; aucun accès général aux fichiers, shell, réseau distant ou mise à jour automatique n’est accordé au frontend. L’import utilise le sélecteur de fichiers HTML existant et la même validation métier. Ne publier que les bundles compilés ; aucune sauvegarde de test n’est incluse dans les ressources.
