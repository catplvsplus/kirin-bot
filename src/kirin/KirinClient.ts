import { ServerManager, type Server } from '@kirinmc/core';
import { Collection } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseModule } from 'reciple';
import { ServerConfig } from '../utils/_ServerConfig.js';
import type { Logger } from '@prtty/print';
import { stripVTControlCharacters } from 'node:util';

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

    public async restart(server: Server): Promise<void> {
        let started: () => void;
        const startedPromise = new Promise<void>(resolve => started = resolve);

        await server.stop();

        server.once('processStart', () => started());

        await server.start();

        return startedPromise;
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
            const channels = await config.fetchLogChannels();

            for (const channel of channels) {
                await channel.send(stripVTControlCharacters(message)).catch(() => null);
            }
        }

        server.on('processStdout', data => broadcast(data));
        server.on('processStderr', data => broadcast(data));

        server.on('processStart', () => this.logger.log(`Server "${server.name}" started.`));
        server.on('processStop', (_, result) => this.logger.log(`Server "${server.name}" stopped: ${result instanceof Error ? result.message : result?.stderr ?? result?.stdout}`));
    }

    public async onServerDelete(server: Server): Promise<void> {
        const config = this.configurations.get(server.id);

        if (config) {
            await config.save();

            this.configurations.delete(server.id);
        }

        this.logger.log(`Unloaded configuration for "${server.name}"`);
    }
}

export default new KirinClient();