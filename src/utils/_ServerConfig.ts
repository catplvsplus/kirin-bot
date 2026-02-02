import type { PermissionResolvable } from 'discord.js';
import z from 'zod';

export class ServerConfig implements ServerConfig.Data {
    public data: ServerConfig.Data = {
        permissions: {
            start: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: [],
                mustHaveAll: true
            },
            stop: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: [],
                mustHaveAll: true
            },
            restart: {
                allowedUsers: [],
                requiredRoles: [],
                requiredPermissions: [],
                mustHaveAll: true
            }
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
}

export namespace ServerConfig {
    export type ActionType = 'start'|'stop'|'restart';

    export interface Data {
        permissions: Record<ActionType, ActionPermissionsData>;
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
        message: string;
        allowedActions: ActionType[];
    }

    export interface LogChannelData {
        guildId: string;
        channelId: string;
        type: 'stdout'|'stderr'|'both';
    }

    export const schema = z.object({
        permissions: z.record(
            z.enum(['start', 'stop', 'restart']),
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