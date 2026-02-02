import { ServerManager, type Server } from '@kirinmc/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseModule } from 'reciple';

export class KirinClient extends BaseModule {
    public root: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../servers');
    public kirin: ServerManager = new ServerManager({ root: this.root });

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

    public async onServerCreate(server: Server): Promise<void> {}

    public async onServerDelete(server: Server): Promise<void> {}
}

export default new KirinClient();