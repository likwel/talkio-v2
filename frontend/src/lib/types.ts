export type PresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'INVISIBLE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  presenceStatus?: PresenceStatus;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  imageUrl?: string | null;
  /** Espace personnel implicite (dépôt par défaut Projet/MEAL/Collecte). */
  isPersonal?: boolean;
  _count?: { members: number; channels: number; boards: number };
  /** Messages non lus cumules sur l'espace (badge du rail). */
  unreadCount?: number;
}

/** Rattachement d'espace affiché sur une carte Projet / MEAL / Collecte. */
export interface WorkspaceRef {
  id: string;
  name: string;
  color?: string | null;
  isPersonal?: boolean;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string | null;
  topic: string | null;
  color?: string | null;
  /** Identifiant du fond de conversation (preset). null = defaut. */
  wallpaper?: string | null;
  /** Accuses de lecture (vu / lu) actifs. */
  readReceipts?: boolean;
  /** Createur : seul a pouvoir changer les accuses de lecture. */
  createdById?: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DIRECT';
  _count?: { messages: number; members: number };
  members?: {
    userId: string;
    lastReadAt?: string | null;
    canView?: boolean;
    canRead?: boolean;
    canWrite?: boolean;
    isAdmin?: boolean;
    user: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'presenceStatus'>;
  }[];
  /** Messages non lus (base sur ChannelMember.lastReadAt cote serveur). */
  unreadCount?: number;
  /** Nombre de membres actifs (membres de l'espace moins ceux desactives). */
  activeMemberCount?: number;
}

export interface Attachment {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface WorkspaceDetail extends Workspace {
  members: { role: string; user: User }[];
  channels: Channel[];
}

export interface UserProfile extends User {
  createdAt: string;
  friendState: 'none' | 'friends' | 'incoming' | 'outgoing' | 'self';
  friendshipId: string | null;
  sharedWorkspaces: { id: string; name: string; color?: string | null }[];
}

export type BoardStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  triggerType:
    | 'form.response.created'
    | 'card.moved.done'
    | 'card.created'
    | 'meal.measurement.created'
    | 'message.keyword'
    | 'channel.created';
  triggerConfig: Record<string, string>;
  actionType: 'message.post' | 'card.create' | 'webhook.post';
  actionConfig: Record<string, string>;
  lastRunAt?: string | null;
  runCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'presenceStatus'>;
  attachments?: Attachment[];
  kind?: 'TEXT' | 'CALL';
  /** Details de l'appel pour un message `kind: 'CALL'`. */
  call?: {
    roomId: string;
    type: 'AUDIO' | 'VIDEO';
    status: 'RINGING' | 'ONGOING' | 'ENDED' | 'MISSED';
    startedAt: string;
    endedAt?: string | null;
  } | null;
  parentId?: string | null;
  /** Message cite (fonction « Repondre »). */
  parent?: { id: string; body: string; author: { id: string; fullName: string } } | null;
  /** Nom de l'auteur d'origine si le message a ete transfere. */
  forwardedFrom?: string | null;
  _count?: { replies: number };
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  labels: string[];
  position: number;
  assignees?: { user: Pick<User, 'id' | 'fullName' | 'avatarUrl'> }[];
  _count?: { comments: number };
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  wipLimit?: number | null;
  cards: Card[];
}

export interface Board {
  id: string;
  workspaceId?: string;
  workspace?: WorkspaceRef;
  name: string;
  description?: string | null;
  status: BoardStatus;
  color?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  leadId?: string | null;
  lead?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
  members?: { user: Pick<User, 'id' | 'fullName' | 'avatarUrl'> }[];
  columns?: Column[];
  progress?: { total: number; done: number; pct: number };
  _count?: { columns: number; members: number };
}

export interface Indicator {
  id: string;
  code: string;
  name: string;
  level: 'IMPACT' | 'OUTCOME' | 'OUTPUT' | 'ACTIVITY';
  unit?: string | null;
  baseline?: number | null;
  target?: number | null;
  achieved?: number;
  progress?: number | null;
  measurements?: Measurement[];
}

export interface Measurement {
  id: string;
  value: number;
  periodStart: string;
  periodEnd: string;
  location?: string | null;
  note?: string | null;
}

export interface Project {
  id: string;
  workspace?: WorkspaceRef;
  name: string;
  code?: string | null;
  donor?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  indicators?: Indicator[];
  _count?: { indicators: number; forms: number };
}

export type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'INTEGER'
  | 'DECIMAL'
  | 'DATE'
  | 'DATETIME'
  | 'TIME'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'RATING'
  | 'RANGE'
  | 'SELECT'
  | 'MULTISELECT'
  | 'BOOLEAN'
  | 'ACKNOWLEDGE'
  | 'NOTE'
  | 'BARCODE'
  | 'SIGNATURE'
  | 'GEOPOINT'
  | 'PHOTO';

/** Opérateurs de la logique d'affichage (skip logic « relevant »). */
export type RelevantOp =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'empty'
  | 'notempty';

export type ReviewState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

export interface FormField {
  id?: string;
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  position: number;
  options: string[];
  helpText?: string;
  placeholder?: string;
  defaultValue?: string;
  minValue?: number | null;
  maxValue?: number | null;
  pattern?: string;
  /** Section de rattachement (clé). */
  sectionKey?: string | null;
  /** Skip logic. */
  relevantField?: string | null;
  relevantOp?: RelevantOp | null;
  relevantValue?: string | null;
  /** Contrainte de validation + message. */
  constraintExpr?: string | null;
  constraintMessage?: string | null;
  /** Expression calculée (champ en lecture seule). */
  calculation?: string | null;
  appearance?: string | null;
  rangeStep?: number | null;
}

export interface FormSection {
  id?: string;
  key: string;
  title: string;
  description?: string | null;
  position: number;
  repeatable: boolean;
  repeatLabel?: string | null;
  minRepeat?: number | null;
  maxRepeat?: number | null;
  relevantField?: string | null;
  relevantOp?: RelevantOp | null;
  relevantValue?: string | null;
}

export interface FormDef {
  id: string;
  workspace?: WorkspaceRef;
  title: string;
  description?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  version?: number;
  requireLogin?: boolean;
  allowMultiple?: boolean;
  publicCode?: string | null;
  sections?: FormSection[];
  fields: FormField[];
  _count?: { responses: number; fields: number; sections?: number };
}

/** Définition portable exportée / importée (sans identifiants). */
export interface FormDefinitionExport {
  talkioForm?: number;
  title: string;
  description?: string | null;
  requireLogin?: boolean;
  allowMultiple?: boolean;
  sections?: FormSection[];
  fields: FormField[];
}

export interface FormResponse {
  id: string;
  submittedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  formVersion?: number;
  deviceId?: string | null;
  submittedBy?: { id: string; fullName: string; avatarUrl?: string | null } | null;
  email?: string | null;
  reviewState?: ReviewState;
  reviewNote?: string | null;
  reviewedBy?: { id: string; fullName: string } | null;
  reviewedAt?: string | null;
  /** Lignes brutes : une par (champ, itération). */
  answers: { fieldId: string; groupIndex?: number; value: unknown }[];
}

export interface Calendar {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  color?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendar: Pick<Calendar, 'id' | 'name' | 'color' | 'ownerId'>;
  attendees?: { user: Pick<User, 'id' | 'fullName' | 'avatarUrl'>; status: string }[];
}

export interface EventInput {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface FriendRequest {
  id: string;
  user: User;
  createdAt: string;
}

export interface ActiveCall {
  callId: string;
  roomId: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'RINGING' | 'ONGOING';
  channelId: string;
  participants: number;
  participantsPreview: Pick<User, 'id' | 'fullName' | 'avatarUrl'>[];
}
