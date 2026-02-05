import type { Message, PermissionResolvable, SendableChannels } from 'discord.js';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import z from 'zod';

export class ServerConfig implements ServerConfig.Data {
    public path: string;
    public data: ServerConfig.Data = {
        permissions: {
            view: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: [],
                mustHaveAll: true
            },
            manage: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
            start: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: ['ViewChannel'],
                mustHaveAll: true
            },
            stop: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
            restart: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
        },
        statusMessages: [],
        logChannels: []
    };

    get permissions() {
        return this.data.permissions;
    }

    get statusMessages() {
        return this.data.statusMessages;
    }

    get logChannels() {
        return this.data.logChannels;
    }

    constructor(path: string) {
        this.path = path;
    }

    public async fetchLogChannels(): Promise<SendableChannels[]> {
        const logChannels: SendableChannels[] = [];

        for (const data of this.logChannels) {
            const channel = await useClient().channels.fetch(data.channelId);
            if (!channel || !channel.isSendable()) continue;

            logChannels.push(channel);
        }

        return logChannels;
    }

    public async fetchStatusMessages(): Promise<Message[]> {
        const messages: Message[] = [];

        for (const data of this.statusMessages) {
            const channel = await useClient().channels.fetch(data.channelId);
            if (!channel || !channel.isTextBased()) continue;

            const message = await channel.messages.fetch(data.messageId).catch(() => null);
            if (!message) continue;

            messages.push(message);
        }

        return messages;
    }

    public async hasPermission(options: ServerConfig.PermissionCheckOptions): Promise<boolean> {
        const { allowedUsers, requiredRoles, requiredPermissions, mustHaveAll } = this.permissions[options.action];

        const guild = options.guildId ? await useClient().guilds.fetch(options.guildId).catch(() => null) : null;
        if (!guild && options.guildId) return false;

        const channel = options.channelId ? await useClient().channels.fetch(options.channelId) : null;
        if (!channel && options.channelId) return false;

        const user = await useClient().users.fetch(options.userId).catch(() => null);
        if (!user) return false;

        const member = guild ? await guild.members.fetch(user).catch(() => null) : null;
        if (!member && guild) return false;

        const inAllowedUsers = !allowedUsers.length || allowedUsers.includes(user.id);
        const hasRequiredRoles = requiredRoles.every(roleId => member?.roles.cache.has(roleId));
        const hasRequiredPermissions = requiredPermissions
            ? channel
                ? !channel.isDMBased() && !!channel.permissionsFor(user)?.has(requiredPermissions)
                : !!member?.permissions.has(requiredPermissions)
            : true;

        if (mustHaveAll) {
            return inAllowedUsers && hasRequiredRoles && hasRequiredPermissions;
        } else {
            return inAllowedUsers || hasRequiredRoles || hasRequiredPermissions;
        }
    }

    public async save(): Promise<void> {
        await mkdir(path.dirname(this.path), { recursive: true });
        await writeFile(this.path, stringify(ServerConfig.schema.parse(this.data)));
    }

    public async read(): Promise<void> {
        const exists = await stat(this.path).then(s => s.isFile()).catch(() => false);

        if (!exists) {
            await this.save();
            return;
        }

        this.data = parse(await readFile(this.path, 'utf-8'));
    }
}

export namespace ServerConfig {
    export interface PermissionCheckOptions {
        action: ActionType;
        userId: string;
        guildId?: string;
        channelId?: string;
    }

    export type ActionType = 'start'|'stop'|'restart';

    export interface Data {
        permissions: Record<ActionType|'view'|'manage', ActionPermissionsData>;
        statusMessages: StatusMessageData[];
        logChannels: LogChannelData[];
    }

    export interface ActionPermissionsData {
        allowedUsers: string[];
        requiredRoles: string[];
        requiredPermissions: PermissionResolvable;
        mustHaveAll: boolean;
    }

    export interface StatusMessageData {
        guildId: string;
        channelId: string;
        messageId: string;
        allowedActions: ActionType[];
    }

    export interface LogChannelData {
        guildId: string;
        channelId: string;
        type: 'stdout'|'stderr'|'both';
    }

    export const schema = z.object({
        permissions: z.record(
            z.enum(['view', 'start', 'stop', 'restart']),
            z.object({
                allowedUsers: z.string().array(),
                requiredRoles: z.string().array(),
                requiredPermissions: z.any(),
                mustHaveAll: z.boolean()
            }),
        ),
        statusMessages: z.object({
            guildId: z.string(),
            channelId: z.string(),
            message: z.string(),
        })
        .array(),
        logChannels: z.object({
            guildId: z.string(),
            channelId: z.string(),
            type: z.enum(['stdout', 'stderr', 'both'])
        })
        .array()
    });
}