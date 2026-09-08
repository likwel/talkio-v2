export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  _count?: { members: number; channels: number; boards: number };
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string | null;
  topic: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DIRECT';
  _count?: { messages: number; members: number };
  members?: { userId: string; user: Pick<User, 'id' | 'fullName' | 'avatarUrl'> }[];
}

export interface WorkspaceDetail extends Workspace {
  members: { role: string; user: User }[];
  channels: Channel[];
}

export interface Message {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  author: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
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
  name: string;
  description?: string | null;
  columns?: Column[];
  _count?: { columns: number };
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
  | 'DATE'
  | 'SELECT'
  | 'MULTISELECT'
  | 'BOOLEAN'
  | 'GEOPOINT'
  | 'PHOTO';

export interface FormField {
  id?: string;
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  position: number;
  options: string[];
  helpText?: string;
}

export interface FormDef {
  id: string;
  title: string;
  description?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  fields: FormField[];
  _count?: { responses: number; fields: number };
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
