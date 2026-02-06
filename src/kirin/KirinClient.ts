import { ServerManager, type Server } from '@kirinmc/core';
import { Collection } from '@discordjs/collection';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseModule } from 'reciple';
import { ServerConfig } from '../utils/_ServerConfig.js';
import type { Logger } from '@prtty/print';
import { stripVTControlCharacters } from 'node:util';
import { GlobalConfig } from '../utils/_GlobalConfig.js';

export class KirinClient extends BaseModule {
    public root: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../servers');
    public kirin: ServerManager = new ServerManager({ root: this.root });
    public logger: Logger = useLogger().clone({ label: 'Kirin' });

    public configurations: Collection<string, ServerConfig> = new Collection();
    public config: GlobalConfig = new GlobalConfig(path.join(this.root, 'kirin.global.yml'));

    constructor() {
        super();

        this.onServerCreate = this.onServerCreate.bind(this);
        this.onServerDelete = this.onServerDelete.bind(this);

        this.kirin.on('serverCreate', this.onServerCreate);
        this.kirin.on('serverDelete', this.onServerDelete);
    }

    public async onEnable(): Promise<void> {
        await this.config.read();
        await this.kirin.load();
    }

    public async onDisable(): Promise<void> {
        await this.kirin.save();
        await this.config.save();
    }

    public async restart(server: Server): Promise<void> {
        await server.stop();
        await server.start();
    }

    public filterServers(options?: KirinClient.FilterServersOptions): Collection<string, Server> {
        return this.kirin.servers.filter(server => {
            if (
                options?.query &&
                server.id != options.query &&
                !server.name?.toLowerCase().includes(options.query.toLowerCase())
            ) {
                return false;
            }

            if (options?.status?.length && !options.status.includes(server.status)) return false;
            if (options?.type && server.type != options.type) return false;
            if (options?.isRunning !== undefined && server.isRunning !== options.isRunning) return false;

            return true;
        });
    }

    public async filterByPermission(options: KirinClient.FilterServersByPermissionOptions): Promise<Collection<string, Server>> {
        const servers = new Collection<string, Server>();

        for (const server of options.servers?.values() ?? this.kirin.servers.values()) {
            const config = this.configurations.get(server.id);

            if (config && await config.hasPermission({
                action: options.action,
                userId: options.userId,
                guildId: options.guildId,
                channelId: options.channelId
            })) {
                servers.set(server.id, server);
            }
        }

        return servers;
    }

    public async hasPermission(options: KirinClient.PermissionCheckOptions): Promise<boolean> {
        const { allowedUsers, requiredRoles, allowedGuilds, requiredPermissions, mustHaveAll } = options.permissions;

        const guild = options.guildId ? await useClient().guilds.fetch(options.guildId).catch(() => null) : null;
        if (!guild && options.guildId) return false;

        const channel = options.channelId ? await useClient().channels.fetch(options.channelId) : null;
        if (!channel && options.channelId) return false;

        const user = await useClient().users.fetch(options.userId).catch(() => null);
        if (!user) return false;

        const member = guild ? await guild.members.fetch(user).catch(() => null) : null;
        if (!member && guild) return false;

        const inAllowedUsers = !allowedUsers?.length || allowedUsers.includes(user.id);
        const hasRequiredRoles = !requiredRoles?.length || requiredRoles.every(roleId => member?.roles.cache.has(roleId));
        const inAllowedGuilds = !allowedGuilds?.length || !guild || allowedGuilds.includes(guild.id);
        const hasRequiredPermissions = !requiredPermissions
            || (
                channel
                    ? !channel.isDMBased() && !!channel.permissionsFor(user)?.has(requiredPermissions)
                    : !!member?.permissions.has(requiredPermissions)
            );

        if (mustHaveAll) {
            return inAllowedUsers && hasRequiredRoles && inAllowedGuilds && hasRequiredPermissions;
        } else {
            return inAllowedUsers || hasRequiredRoles || inAllowedGuilds || hasRequiredPermissions;
        }
    }

    public async onServerCreate(server: Server): Promise<void> {
        const config = new ServerConfig(path.join(
            this.kirin.root,
            server.directory,
            'kirin.yml'
        ), server);

        await config.read();

        this.configurations.set(server.id, config);
        this.logger.log(`Loaded configuration for "${server.name}"`);

        const broadcast = async (message: string) => {
            const channels = await config.fetchLogChannels();

            for (const channel of channels) {
                await channel.send(stripVTControlCharacters(message)).catch(() => null);
            }
        }

        server.on('processStdout', data => broadcast(data));
        server.on('processStderr', data => broadcast(data));

        server.on('processStart', () => this.logger.log(`Server "${server.name}" started.`));
        server.on('processStop', (_, result) => this.logger.log(`Server "${server.name}" stopped: ${result instanceof Error ? result.message : result?.stderr ?? result?.stdout}`));
        server.on('statusUpdate', () => config.messages.updateStatusMessage());
    }

    public async onServerDelete(server: Server): Promise<void> {
        const config = this.configurations.get(server.id);

        if (config) {
            await config.save();

            this.configurations.delete(server.id);
        }

        this.logger.log(`Unloaded configuration for "${server.name}"`);
    }

    public async reloadConfigurations(): Promise<void> {
        await this.config.read();
        await this.kirin.load();

        for (const server of this.kirin.servers.values()) {
            const config = this.configurations.get(server.id);

            await config?.read();
        }
    }
}

export namespace KirinClient {
    export interface FilterServersOptions {
        query: string;
        isRunning?: boolean;
        status?: Server.Status[];
        type?: Server.Type;
    }

    export interface FilterServersByPermissionOptions extends GlobalConfig.PermissionCheckOptions {
        servers?: Collection<string, Server>;
    }

    export interface PermissionCheckOptions {
        permissions: GlobalConfig.ActionPermissionsData;
        userId: string;
        guildId?: string;
        channelId?: string;
    }
}

export default new KirinClient();