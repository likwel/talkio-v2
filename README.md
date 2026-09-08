# Talkio

Plateforme collaborative centree sur la **messagerie** (serveurs / salons / messages directs, style Slack-Discord), avec **appels audio / visio-conference**, **gestion de projet** (Kanban + vue liste, statut, avancement, chef & equipe), **agenda** (style Google Agenda), **MEAL** (suivi-evaluation), **collecte de donnees** (formulaires d'enquete personnalisables) et un moteur d'**automatisation** inter-modules. La messagerie est l'ecran d'accueil (`/`). Ordre du rail : Messagerie · **Projet** · Agenda · MEAL · Collecte.

- **Interface moderne & responsive** : rail de navigation unique — **les icones restent visibles quand il est replie** (72 px), les libelles apparaissent une fois deploye (236 px). Sur **tablette / mobile** le rail devient un **tiroir** (barre superieure + hamburger + fond assombri) et la messagerie passe en **une seule colonne** (liste ↔ conversation avec bouton retour) ; toutes les pages s'adaptent (agenda en vue Jour + panneau lateral en surimpression, formulaires empiles, titres reduits, padding reduit). Police **Inter / Inter Tight**. Classes utilitaires dans `src/index.css`.
- **Espaces de travail** : les **3 plus recemment utilises** dans le rail, puis un bouton **« Voir plus (N) »** qui ouvre la liste complete (recherche) dans une fenetre modale. Ordre de recence memorise (`localStorage`).
- **Messagerie** : rail (espaces) → panneau conversations (**Salons** `#` + **Messages directs**, recherche, bouton **Amis**) → fil de discussion. Conversations **1:1 ou de groupe** (fenetre « Nouvelle conversation » a selection multiple). **Indicateur d'appel/visio en cours** sur chaque salon/DM (pastille verte animee + nombre de participants) et banniere **« Rejoindre »** dans l'en-tete de la conversation concernee (temps reel via socket `calls:active-changed`).
- **Systeme d'amitie** : demande par email, acceptation / refus, liste d'amis avec bouton **Message** ; endpoints `/api/friends*`, notification socket `friend:changed`.
- **Projet** (`/projects`) : chaque projet a un **statut** (Actif / En pause / Termine / Archive), des **dates**, un **chef de projet**, une **equipe**, une **couleur** et un **avancement %** (calcule sur les colonnes « Termine »). Deux vues : **Kanban** (glisser-deposer) et **Liste** (tableau des taches avec priorite, echeance en rouge si depassee, assignes). Parametres du projet dans une fenetre dediee.
- **Collecte** : formulaires d'enquete **personnalisables** — texte d'aide, placeholder, valeur par defaut, bornes min/max (nombre), motif regex (texte), champs obligatoires. Page **Reponses** (`/forms/:id/responses`) : tableau une ligne par soumission, une colonne par champ, mini-statistiques (moyenne/min/max, repartition) + export CSV.
- **Automatisation** (onglet dans Parametres) : moteur de regles **declencheur -> action** reliant les modules. Declencheurs : reponse de formulaire, tache passee en « Termine », mesure MEAL enregistree, message contenant un mot-cle. Actions : publier un message dans un salon, creer une tache dans un projet. Modele de texte avec jetons `{{summary}}`, `{{author}}`, `{{form.title}}`… Endpoints `/api/automations`, dispatch dans `modules/automations/dispatch.ts`.
- **Themes de couleur** : dans Parametres → Apparence, **couleur d'accent** au choix (palette de preselections + hex libre) appliquee via les variables `--accent*`. Chaque **espace** peut imposer sa propre couleur (devient l'accent global quand il est actif) ; chaque **salon / conversation** a une couleur (pastille + en-tete). `PATCH /workspaces/:id`, `PATCH /channels/:id`.
- **Profil en modal** : clic sur un nom / avatar (messages, listes de membres) ouvre une fiche (`GET /users/:id`) avec statut d'amitie, boutons Message / Ajouter en ami, espaces en commun.
- **Gestion des membres** : ajouter / retirer des membres d'un **salon** (`POST/DELETE /channels/:id/members`), d'un **espace** (`POST/DELETE /workspaces/:id/members`, invitation par email) et d'un **projet** (`POST/DELETE /boards/:id/members`).
- **Parametres** (bouton dans le rail + menu du compte) : onglets **Profil**, **Apparence** (theme clair / sombre / systeme + couleur d'accent), **Automatisation**, **Securite**, **Compte**.
- **Aucun `alert()` / `prompt()` / `confirm()` natif** : fenetres modales maison (`DialogProvider`) ; contenus qui defilent si la hauteur est serree.
- Icones **Material Symbols** (`react-icons/md`), centralisees dans `src/lib/icons.ts`.
- Couleur par defaut : vert **#0CAE36** ; toute l'UI utilise `--accent`, `--accent-soft`, `--accent-strong`, `--accent-ring` (recalcules en JS depuis la couleur choisie).

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
| Workspaces | `GET/POST /workspaces`, `GET /workspaces/:id`, `POST /workspaces/:id/members` |
| Auth       | `POST /auth/{register,login,refresh,logout}`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Messagerie | `GET/POST /channels`, `POST /channels/direct` (`userIds[]` -> 1:1 ou groupe), `GET/POST /messages`, `PATCH/DELETE /messages/:id` |
| Appels     | `POST /calls`, `GET /calls/active?workspaceId=`, `GET /calls/:roomId`, `POST /calls/:roomId/join`, `/leave` |
| Amis       | `GET /friends`, `GET /friends/requests`, `POST /friends/request` (`{email}`), `POST /friends/:id/{accept,decline}`, `DELETE /friends/:userId` |
| Kanban     | `GET/POST /boards`, `GET /boards/:id`, colonnes & cartes, `POST /boards/cards/:id/move` |
| Agenda     | `GET/POST/PATCH/DELETE /calendar/calendars`, `GET/POST/PATCH/DELETE /calendar/events?from=&to=` |
| MEAL       | `GET/POST /meal/projects`, indicateurs (`/projects/:id/indicators`), mesures (`/indicators/:id/measurements`) |
| Collecte   | `GET/POST /forms`, `PUT /forms/:id`, `POST /forms/:id/responses`, `GET /forms/:id/export.csv` |

## Temps reel (Socket.IO)

Authentification par JWT dans `handshake.auth.token`.

- `channel:subscribe` / `message:new` / `message:updated` / `message:deleted` / `typing`
- `board:subscribe` / `board:changed`
- `calendar:subscribe <workspaceId>` / `calendar:changed` (`{ change: 'created' | 'updated' | 'deleted', event }`)
- `calls:subscribe <workspaceId>` / `calls:active-changed` — rafraichit les indicateurs d'appel en cours
- `friend:changed` (room `user:<id>`) — rafraichit la liste d'amis / demandes
- `call:join` / `call:peer-joined` / `call:signal` / `call:peer-left` (signalisation WebRTC)

## Notes

- La visio utilise un maillage WebRTC (mesh) adapte aux petits groupes ; pour de grandes salles, brancher un SFU (mediasoup, LiveKit…).
- Le stockage des pieces jointes / photos est modelise mais l'upload binaire n'est pas implemente (a brancher sur S3 / disque).
