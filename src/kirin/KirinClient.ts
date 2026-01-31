import { ServerManager } from '@kirinmc/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseModule } from 'reciple';

export class KirinClient extends BaseModule {
    public root: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../servers');
    public kirin: ServerManager = new ServerManager({
        root: this.root
    });

    public async onEnable(): Promise<void> {
        await this.kirin.load();
    }

    public async onDisable(): Promise<void> {
        await this.kirin.save();
    }
}

export default new KirinClient();