import { ChannelType, type PermissionResolvable } from 'discord.js';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import z from 'zod';
import KirinClient from '../kirin/KirinClient.js';

export class GlobalConfig {
    public path: string;
    public data: GlobalConfig.Data = {
        permissions: {
            view: {
                allowedUsers: [],
                requiredRoles: [],
                allowedGuilds: [],
                requiredPermissions: [],
                mustHaveAll: true
            },
            manage: {
                allowedUsers: [],
                requiredRoles: [],
                allowedGuilds: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
            start: {
                allowedUsers: [],
                requiredRoles: [],
                allowedGuilds: [],
                requiredPermissions: ['ViewChannel'],
                mustHaveAll: true
            },
            stop: {
                allowedUsers: [],
                requiredRoles: [],
                allowedGuilds: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
            restart: {
                allowedUsers: [],
                requiredRoles: [],
                allowedGuilds: [],
                requiredPermissions: ['Administrator'],
                mustHaveAll: true
            },
        }
    };

    get permissions() {
        return this.data.permissions;
    }

    constructor(path: string) {
        this.path = path;
    }

    public async hasPermission(options: GlobalConfig.PermissionCheckOptions): Promise<boolean> {
        const permissions = this.permissions[options.action];
        if (!permissions) return false;

        return KirinClient.hasPermission({
            ...options,
            permissions
        });
    }

    public async save(): Promise<void> {
        await mkdir(path.dirname(this.path), { recursive: true });
        await writeFile(this.path, stringify(GlobalConfig.schema.parse(this.data)));
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

export namespace GlobalConfig {
    export const sendableChannelTypes = [
        ChannelType.GuildText,
        ChannelType.GuildStageVoice,
        ChannelType.GuildVoice
    ] as const;

    export type ServerActionType = 'start'|'stop'|'restart';
    export type ActionType = ServerActionType|'view'|'manage';

    export interface PermissionCheckOptions {
        action: keyof Data['permissions'];
        userId: string;
        guildId?: string;
        channelId?: string;
    }

    export interface Data {
        permissions: Record<ActionType, ActionPermissionsData|null>;
    }

    export interface ActionPermissionsData {
        allowedUsers?: string[];
        requiredRoles?: string[];
        allowedGuilds?: string[];
        requiredPermissions?: PermissionResolvable;
        mustHaveAll?: boolean;
    }

    export const schema = z.object({
        permissions: z.record(
            z.enum(['view', 'manage', 'start', 'stop', 'restart']),
            z.object({
                allowedUsers: z.string().array().optional(),
                requiredRoles: z.string().array().optional(),
                allowedGuilds: z.string().array().optional(),
                requiredPermissions: z.any().optional(),
                mustHaveAll: z.boolean().optional()
            }),
        )
    });
}