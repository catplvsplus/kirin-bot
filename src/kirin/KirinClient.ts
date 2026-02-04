import { ServerManager, type Server } from '@kirinmc/core';
import { Collection } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseModule } from 'reciple';
import { ServerConfig } from '../utils/_ServerConfig.js';
import type { Logger } from '@prtty/print';

export class KirinClient extends BaseModule {
    public root: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../servers');
    public kirin: ServerManager = new ServerManager({ root: this.root });
    public logger: Logger = useLogger().clone({ label: 'Kirin' });

    public configurations: Collection<string, ServerConfig> = new Collection();

    constructor() {
        super();

        this.onServerCreate = this.onServerCreate.bind(this);
        this.onServerDelete = this.onServerDelete.bind(this);

        this.kirin.on('serverCreate', this.onServerCreate);
        this.kirin.on('serverDelete', this.onServerDelete);
    }

    public async onEnable(): Promise<void> {
        await this.kirin.load();
    }

    public async onDisable(): Promise<void> {
        await this.kirin.save();
    }

    public async onServerCreate(server: Server): Promise<void> {
        const config = new ServerConfig(path.join(
            this.kirin.root,
            server.directory,
            'kirin.yml'
        ));

        await config.read();

        this.configurations.set(server.id, config);
        this.logger.log(`Loaded configuration for "${server.name}"`);

        const broadcast = async (message: string) => {
            this.logger.log(message);

            const channels = await config.fetchLogChannels();

            for (const channel of channels) {
                await channel.send(message).catch(() => null);
            }
        }

        server.on('processStdout', data => broadcast(data));
        server.on('processStderr', data => broadcast(data));

        server.on('processStart', () => broadcast(`Server "${server.name}" started.`));
        server.on('processStop', (_, result) => broadcast(`Server "${server.name}" stopped.\n${result instanceof Error ? result.message : result?.stderr ?? result?.stdout}`));
    }

    public async onServerDelete(server: Server): Promise<void> {
        const config = this.configurations.get(server.id);

        if (config) this.configurations.delete(server.id);

        this.logger.log(`Unloaded configuration for "${server.name}"`);
    }
}

export default new KirinClient();