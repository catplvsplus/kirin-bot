import { type SendableChannels } from 'discord.js';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import z from 'zod';
import KirinClient from '../kirin/KirinClient.js';
import { GlobalConfig } from './_GlobalConfig.js';
import { StatusMessageManager } from './_StatusMessageManager.js';
import type { Server } from '@kirinmc/core';

export class ServerConfig implements ServerConfig.Data {
    public path: string;
    public data: ServerConfig.Data = {
        permissions: {
            manage: 'default',
            view: 'default',
            start: 'default',
            stop: 'default',
            restart: 'default'
        },
        statusMessages: [],
        logChannels: []
    };

    public messages: StatusMessageManager = new StatusMessageManager(this);

    get permissions() {
        return this.data.permissions;
    }

    get statusMessages() {
        return this.data.statusMessages;
    }

    get logChannels() {
        return this.data.logChannels;
    }

    constructor(path: string, public server: Server) {
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

    public async hasPermission(options: GlobalConfig.PermissionCheckOptions): Promise<boolean> {
        const permissions = this.permissions[options.action];

        if (!permissions) {
            return false;
        } else if (permissions === 'default') {
            return KirinClient.config.hasPermission(options);
        }

        return KirinClient.hasPermission({
            ...options,
            permissions: permissions
        });
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

        this.data = ServerConfig.schema.parse(parse(await readFile(this.path, 'utf-8')));
    }
}

export namespace ServerConfig {
    export interface Data {
        permissions: Record<GlobalConfig.ActionType, GlobalConfig.ActionPermissionsData|'default'|null>;
        statusMessages: StatusMessageData[];
        logChannels: LogChannelData[];
    }

    export interface StatusMessageData {
        guildId: string;
        channelId: string;
        messageId: string;
        allowedActions: GlobalConfig.ServerActionType[];
    }

    export interface LogChannelData {
        guildId: string;
        channelId: string;
        type: 'stdout'|'stderr'|'both';
    }

    export const schema = z.object({
        permissions: z.record(
            z.enum(['view', 'manage', 'start', 'stop', 'restart']),
            z.nullable(
                z.object({
                    allowedUsers: z.string().array().optional(),
                    requiredRoles: z.string().array().optional(),
                    allowedGuilds: z.string().array().optional(),
                    requiredPermissions: z.any().optional(),
                    mustHaveAll: z.boolean().optional()
                }).or(
                    z.literal('default')
                )
            )
        ),
        statusMessages: z.object({
            guildId: z.string(),
            channelId: z.string(),
            messageId: z.string(),
            allowedActions: z.array(z.enum(['start', 'stop', 'restart']))
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