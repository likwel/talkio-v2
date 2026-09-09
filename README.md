# Talkio

Plateforme collaborative centree sur la **messagerie** (serveurs / salons / messages directs, style Slack-Discord), avec **appels audio / visio-conference**, **gestion de projet** (Kanban + vue liste, statut, avancement, chef & equipe), **agenda** (style Google Agenda), **MEAL** (suivi-evaluation), **collecte de donnees** (formulaires d'enquete personnalisables) et un moteur d'**automatisation** inter-modules. La messagerie est l'ecran d'accueil (`/`). Ordre du rail : Messagerie · **Projet** · Agenda · MEAL · Collecte.

- **Interface moderne & responsive** : rail de navigation unique sur desktop — **les icones restent visibles quand il est replie** (72 px), les libelles apparaissent une fois deploye (236 px). Sur **tablette / mobile** la navigation entre modules passe dans une **barre d'onglets fixe en bas** (`BottomNav`) et le rail devient un **tiroir** (barre superieure + hamburger) reserve aux espaces + compte ; la messagerie passe en **une seule colonne** (liste ↔ conversation avec bouton retour) ; toutes les pages s'adaptent (barre d'outils agenda sur 2 rangees, modales en feuille du bas, tables qui defilent, titres reduits, padding reduit, zones sures iOS). **Echelle typographique unique** (`theme.fontSize` + classes `.page-title` / `.section-title` / `.meta`), **systeme de boutons unique** (`.btn-{primary|tonal|outlined|text|danger}` + tailles `.btn-sm` / `.btn-lg`) et **`<Select>` maison cherchable** (`src/components/Select.tsx`, popover en `position: fixed`) a la place de tous les `<select>` natifs. Les **titres d'elements cliquables** (`.item-title` dans un parent `.group`) passent en couleur d'accent au survol. **Chargement paresseux** : chaque page est un chunk `React.lazy` (`App.tsx`), avec une **barre de progression fine en degrade** en haut de l'ecran (`TopProgress`, pilotee par les chunks de route + `useIsFetching`, apparait au-dela de 180 ms). Police **Inter / Inter Tight**. Classes utilitaires dans `src/index.css`.
- **Espaces de travail** : les **3 plus recemment utilises** dans le rail, puis un bouton **« Voir plus (N) »** (liste complete + recherche en modale). Ordre de recence memorise (`localStorage`). **Badge de messages non lus** sur chaque espace du rail (et sur « Voir plus » pour les espaces masques) — `GET /workspaces` renvoie `unreadCount` par espace, rafraichi toutes les 20 s + au focus. Hors de la messagerie, une **bulle flottante en bas a droite** (`FloatingUnread`) affiche les non lus en **temps reel** (socket `message:notify` -> room `user:<id>` a chaque nouveau message), en **pastilles de couleur distinctes** (salons `#` en accent, directs `@` en violet), avec **animation** a l'arrivee et **son** (`MessageNotifier`, bip WebAudio, coupe si on est deja actif dans la messagerie ; desactivable via `localStorage['talkio.mute']='1'`).
- **Messagerie** : rail (espaces) → panneau conversations (**Salons** `#` + **Messages directs**, recherche, bouton **Amis**, **compteur de non lus**) → fil de discussion. Chaque groupe de messages affiche le **nom de l'auteur facon WhatsApp** (petit, colore par utilisateur, italique). L'avatar de l'auteur est aligne **en haut** du groupe (une seule photo pour des messages successifs). **Actions au survol** : **Repondre** (uniquement aux messages des autres — message cite, champ `parentId`), **Partager** (repost — texte + pieces jointes — vers n'importe quel canal, fenetre avec recherche ; le message repostee affiche **« Transfere · de X »**, champ `forwardedFrom`), **Modifier** et **Supprimer** (ses propres messages, `PATCH/DELETE /messages/:id`, temps reel `message:updated` / `message:deleted`). **Mentions** : `@` dans la zone de saisie propose les membres ; `@Prenom` est surligne dans le fil. **Pieces jointes** : trombone, **2 Mo max** (`POST /api/uploads`). En-tete : groupe **Appel / Visio / Membres**. **Appels** : lancer depuis l'en-tete ; les autres membres recoivent une **modale d'appel entrant globale** (Accepter / Refuser / Ignorer, `call:ring`), un **appel audio demarre camera coupee** (activable ensuite, comme WhatsApp) ; chaque appel laisse un **evenement dans le fil** (message `kind: CALL` — « en cours » avec bouton **Rejoindre**, « termine · duree », ou « manque »). **Statut de presence** (En ligne / Absent / Ne pas deranger / Invisible) : pastille sur les avatars — presence temps reel (`presence:snapshot` / `presence:changed`), change instantanement via le **selecteur de statut** en haut de **Parametres → Profil**, de **ProfileModal**, et en **survol du bouton de compte** (`PATCH /users/me/status`). Non lus bases sur `ChannelMember.lastReadAt` (`POST /channels/:id/read`).
- **Systeme d'amitie** : demande par email, acceptation / refus, liste d'amis avec bouton **Message** ; endpoints `/api/friends*`, notification socket `friend:changed`.
- **Projet** (`/projects`) : chaque projet a un **statut** (Actif / En pause / Termine / Archive), des **dates**, un **chef de projet**, une **equipe**, une **couleur** et un **avancement %**. Deux vues : **Kanban** (glisser-deposer) et **Liste**. **Clic sur une tache → fiche** (titre, description, priorite, echeance) avec **assignation d'une ou plusieurs personnes** de l'espace (`POST/DELETE /boards/cards/:cardId/assignees`). Les niveaux du cadre logique s'affichent en **langage clair** (Impact / Resultat / Produit / Activite, sigle entre parentheses). Les pages d'accueil **Projet / MEAL / Collecte** partagent la meme mise en page (en-tete titre + sous-titre + bouton *Nouveau*, barre d'outils avec compteur + filtres + **bascule Grille / Liste** memorisee, cartes uniformes, etat vide `EmptyState`) et une **pagination cote client** (`components/Pagination.tsx` : suite de pages avec ellipses, remise a la page 1 sur changement de filtre/vue) — presente aussi sur les tableaux (reponses de formulaire, vue Liste d'un projet).
- **Collecte** : formulaires d'enquete **personnalisables** — texte d'aide, placeholder, valeur par defaut, bornes min/max (nombre), motif regex (texte), champs obligatoires. **Cycle de publication** : un formulaire est cree en **Brouillon**, puis **Publie** (bouton « Publier » sur la carte, ou « Enregistrer et publier » dans l'editeur) — un **lien public** copiable apparait (`/f/:id`, style Google Docs : **n'importe qui avec le lien repond, sans compte**) —, enfin **Ferme** (« Fermer la collecte ») pour desactiver le lien ; un formulaire ferme se **rouvre**. Le lien public sert les routes non authentifiees `GET /api/public/forms/:id` et `POST /api/public/forms/:id/responses` (reponses anonymes, `submittedById = null`) ; changement d'etat via `PUT /forms/:id { status }`. Saisie interne authentifiee toujours dispo sur `/forms/:id/fill`. Page **Reponses** (`/forms/:id/responses`) : tableau une ligne par soumission, une colonne par champ, mini-statistiques (moyenne/min/max, repartition) + export CSV.
- **Automatisation** (fenetre dediee `AutomationsModal`, ouverte depuis le menu du compte) : moteur de regles **declencheur -> action** reliant les modules. Declencheurs : reponse de formulaire, tache passee en « Termine », mesure MEAL enregistree, message contenant un mot-cle. Actions : publier un message dans un salon, creer une tache dans un projet. Modele de texte avec jetons `{{summary}}`, `{{author}}`, `{{form.title}}`… Endpoints `/api/automations`, dispatch dans `modules/automations/dispatch.ts`.
- **Themes de couleur** : dans Parametres → Apparence, **couleur d'accent** au choix (palette de preselections + hex libre) appliquee via les variables `--accent*`. Chaque **espace** peut imposer sa propre couleur (devient l'accent global quand il est actif) ; chaque **salon / conversation** a une couleur (pastille + en-tete). `PATCH /workspaces/:id`, `PATCH /channels/:id`.
- **Profil en modal** : clic sur un nom / avatar (messages, listes de membres) ouvre une fiche (`GET /users/:id`) avec statut d'amitie, boutons Message / Ajouter en ami, espaces en commun.
- **Gestion des membres** : ajouter / retirer des membres d'un **salon** (`POST/DELETE /channels/:id/members`, panneau avec **recherche** depuis l'en-tete de la conversation), d'un **espace** (`POST/DELETE /workspaces/:id/members`, invitation par email), d'un **projet** (`POST/DELETE /boards/:id/members`) et d'une **tache** (`POST/DELETE /boards/cards/:cardId/assignees`).
- **Compte & parametres** : le rail n'affiche qu'un **bouton de compte** (avatar + statut, **nom et e-mail** sur deux lignes) ; son menu deroulant : **Voir mon profil** → `ProfileModal` ; **Changer le statut** → sous-menu qui s'ouvre **au survol** (En ligne / Absent / Ne pas deranger / Invisible, application immediate) ; **Modifier le profil** et **Parametres** → `SettingsModal` (onglets **Profil**, **Apparence**, **Securite**, **Compte** — plus d'onglet Automatisation) ; **Automatisation** → `AutomationsModal` ; **Amis** → `FriendsModal` (Amis / Demandes recues / **En attente** envoyees / Ajouter par e-mail) ; **Se deconnecter**.
- **Aucun `alert()` / `prompt()` / `confirm()` natif** : fenetres modales maison (`DialogProvider`) ; contenus qui defilent si la hauteur est serree.
- Icones **Material Symbols** (`react-icons/md`), centralisees dans `src/lib/icons.ts`.
- Couleur par defaut : **rose #FF2C5F** (violet #8774E1 en accent secondaire) ; toute l'UI utilise `--accent`, `--accent-soft`, `--accent-strong`, `--accent-ring` (recalcules en JS depuis la couleur choisie).

## Stack

| Couche   | Technologies                                              |
| -------- | -------------------------------------------------------- |
| Backend  | Node.js, TypeScript, Express, Prisma, PostgreSQL, Socket.IO |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Query, socket.io-client, react-icons (Material Symbols), police Inter |
| Temps reel | Socket.IO (messages, kanban, agenda) + signalisation WebRTC (mesh) pour la visio |

```
talkio/
├── backend/    # API REST + WebSocket
│   ├── prisma/schema.prisma
│   └── src/
│       ├── modules/{auth,workspaces,channels,messages,boards,meal,forms,calls,calendar,friends}
│       ├── realtime/socket.ts
│       ├── app.ts  server.ts
│       └── ...
└── frontend/   # SPA React
    └── src/
        ├── pages/{Login,Register,Chat,CallRoom,Calendar,Boards,BoardDetail,Meal,ProjectDetail,Forms,FormBuilder,FormFill}
        ├── components/calendar/{MiniMonth,TimeGridView,MonthView,EventDialog}
        ├── context/{AuthContext,WorkspaceContext,ThemeContext}
        └── lib/{api,socket,types,date,icons}
```

## Demarrage rapide

### 1. Base de donnees

```bash
cd talkio
docker compose up -d db      # PostgreSQL sur localhost:5432
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate       # cree le schema
npm run seed                 # donnees de demo (alice@talkio.dev / password123)
npm run dev                  # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

Comptes de demo : `alice@talkio.dev` et `bob@talkio.dev`, mot de passe `password123`.

## API (prefixe `/api`)

| Domaine    | Endpoints principaux |
| ---------- | -------------------- |
| Workspaces | `GET/POST /workspaces` (+ `unreadCount` par espace), `GET /workspaces/:id`, `POST /workspaces/:id/members` |
| Auth       | `POST /auth/{register,login,refresh,logout}`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Utilisateurs | `GET /users/:id`, `PATCH /users/me/status` (`ONLINE` / `AWAY` / `BUSY` / `INVISIBLE`) |
| Messagerie | `GET/POST /channels`, `POST /channels/direct` (`userIds[]` -> 1:1 ou groupe), `POST /channels/:id/read`, `GET/POST /messages` (`attachments[]`, `parentId`, `forwardedFrom`), `PATCH/DELETE /messages/:id` |
| Fichiers   | `POST /api/uploads` (corps brut, 2 Mo max) ; statique : `/api/uploads/files/*` |
| Appels     | `POST /calls`, `GET /calls/active?workspaceId=`, `GET /calls/:roomId`, `POST /calls/:roomId/join` / `/leave` / `/decline` |
| Amis       | `GET /friends`, `GET /friends/requests`, `POST /friends/request` (`{email}`), `POST /friends/:id/{accept,decline}`, `DELETE /friends/:userId` |
| Kanban     | `GET/POST /boards`, `GET /boards/:id`, colonnes & cartes, `POST /boards/cards/:id/move` |
| Agenda     | `GET/POST/PATCH/DELETE /calendar/calendars`, `GET/POST/PATCH/DELETE /calendar/events?from=&to=` |
| MEAL       | `GET/POST /meal/projects`, indicateurs (`/projects/:id/indicators`), mesures (`/indicators/:id/measurements`) |
| Collecte   | `GET/POST /forms`, `PUT /forms/:id`, `POST /forms/:id/responses`, `GET /forms/:id/export.csv` |
| Public (sans auth) | `GET /public/forms/:id`, `POST /public/forms/:id/responses` (formulaire PUBLIE uniquement) |

## Temps reel (Socket.IO)

Authentification par JWT dans `handshake.auth.token`.

- `channel:subscribe` / `message:new` / `message:updated` / `message:deleted` / `typing`
- `message:notify` (room `user:<id>`, `{ channelId, workspaceId, isDirect, from, preview }`) — compteurs de non lus + son, en dehors du canal ouvert
- `board:subscribe` / `board:changed`
- `calendar:subscribe <workspaceId>` / `calendar:changed` (`{ change: 'created' | 'updated' | 'deleted', event }`)
- `calls:subscribe <workspaceId>` / `calls:active-changed` — rafraichit les indicateurs d'appel en cours
- `friend:changed` (room `user:<id>`) — rafraichit la liste d'amis / demandes
- `presence:snapshot` (liste des `userId` en ligne, a la connexion) / `presence:changed` (`{ userId, online?, status? }`) — pastilles de statut
- `call:ring` (appel entrant, room `user:<id>`) / `call:declined` / `call:join` / `call:peer-joined` / `call:signal` / `call:peer-left` (signalisation WebRTC)

## Notes

- La **visio** utilise un maillage WebRTC (mesh) avec **negociation parfaite** (perfect negotiation : `polite`/`impolite`, gestion des collisions d'offres, `restartIce` sur echec), plusieurs serveurs STUN, contraintes 720p/30 + suppression d'echo/bruit. Interface : grille responsive, **anneau « prend la parole »** (analyse WebAudio), **partage d'ecran** (`getDisplayMedia` + `replaceTrack`, sans renegociation), plein ecran, indicateur d'etat de connexion, badges micro/camera. Pour de grandes salles, brancher un SFU (mediasoup, LiveKit…).
- Les pieces jointes sont stockees sur le **disque local** du backend (`backend/uploads/`, servi sous `/api/uploads/files/`). Pour la prod, brancher un stockage objet (S3…) dans `modules/uploads/uploads.routes.ts`.
