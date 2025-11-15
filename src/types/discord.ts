// Discord API Types for HTTP Interactions

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
}

export enum ApplicationCommandOptionType {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
  CHANNEL = 7,
  ROLE = 8,
  MENTIONABLE = 9,
  NUMBER = 10,
  ATTACHMENT = 11,
}

export interface InteractionRequest {
  type: InteractionType;
  id: string;
  application_id: string;
  token: string;
  version: number;
  data?: InteractionData;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  user?: User;
  message?: Message;
}

export interface InteractionData {
  id: string;
  name: string;
  type: number;
  options?: InteractionDataOption[];
  resolved?: {
    users?: Record<string, User>;
    members?: Record<string, GuildMember>;
    roles?: Record<string, Role>;
    channels?: Record<string, Channel>;
  };
}

export interface InteractionDataOption {
  name: string;
  type: ApplicationCommandOptionType;
  value?: string | number | boolean;
  options?: InteractionDataOption[];
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  global_name?: string;
}

export interface GuildMember {
  user?: User;
  nick?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  permissions?: string;
}

export interface Role {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
}

export interface Channel {
  id: string;
  type: number;
  name?: string;
  permissions?: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author: User;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: User[];
  mention_roles: string[];
  attachments: Attachment[];
  embeds: Embed[];
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: EmbedFooter;
  image?: EmbedImage;
  thumbnail?: EmbedThumbnail;
  author?: EmbedAuthor;
  fields?: EmbedField[];
}

export interface EmbedFooter {
  text: string;
  icon_url?: string;
}

export interface EmbedImage {
  url: string;
  height?: number;
  width?: number;
}

export interface EmbedThumbnail {
  url: string;
  height?: number;
  width?: number;
}

export interface EmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface InteractionResponse {
  type: InteractionResponseType;
  data?: InteractionResponseData;
}

export interface InteractionResponseData {
  tts?: boolean;
  content?: string;
  embeds?: Embed[];
  allowed_mentions?: AllowedMentions;
  flags?: number;
  components?: MessageComponent[];
}

export interface AllowedMentions {
  parse?: ('roles' | 'users' | 'everyone')[];
  roles?: string[];
  users?: string[];
  replied_user?: boolean;
}

export interface MessageComponent {
  type: number;
  components?: MessageComponent[];
  custom_id?: string;
  disabled?: boolean;
  style?: number;
  label?: string;
  emoji?: Emoji;
  url?: string;
}

export interface Emoji {
  id?: string;
  name?: string;
  animated?: boolean;
}

// Message Flags
export const MessageFlags = {
  EPHEMERAL: 1 << 6, // 64 - Only the user receiving the message can see it
  LOADING: 1 << 7, // 128 - Message has not been sent yet
} as const;

// Command Definitions for Registration
export interface ApplicationCommand {
  name: string;
  description: string;
  options?: ApplicationCommandOption[];
  type?: number;
  default_member_permissions?: string | null;
  dm_permission?: boolean;
  default_permission?: boolean;
  nsfw?: boolean;
}

export interface ApplicationCommandOption {
  type: ApplicationCommandOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: ApplicationCommandOptionChoice[];
  options?: ApplicationCommandOption[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}

export interface ApplicationCommandOptionChoice {
  name: string;
  value: string | number;
}

