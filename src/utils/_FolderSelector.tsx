import { ActionRow, Button, Container, Label, Modal, Section, Separator, TextDisplay, TextInput } from '@reciple/jsx';
import { ButtonStyle, ComponentType, MessageFlags, TextInputStyle, type InteractionEditReplyOptions, type RepliableInteraction } from 'discord.js';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export class FolderSelector {
    public cwd: string;
    public items: string[] = [];
    public interaction: RepliableInteraction;

    public constructor(options: FolderSelector.Options) {
        this.cwd = options.cwd;
        this.interaction = options.interaction;
    }

    public async select(options?: FolderSelector.MessageDataOptions): Promise<string|null> {
        await this.chdir(this.cwd);

        const message = await this.interaction.editReply(await this.createMessageData(options));

        const componentCollector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: interaction => interaction.user.id === this.interaction.user.id,
            time: 1000 * 60 * 5
        });

        let handleConfirm: (value: string|null) => void;
        let promise = new Promise<string|null>(resolve => handleConfirm = resolve);

        componentCollector.on('collect', async interaction => {
            const id = interaction.customId as 'new-folder'|`open:${number}`|'cancel'|'confirm';

            switch (id) {
                case 'cancel':
                    await interaction.update(await this.createMessageData({ ...options, disabled: true }));
                    handleConfirm(null);
                    break;
                case 'confirm':
                    await interaction.update(await this.createMessageData({ ...options, disabled: true }));
                    handleConfirm(this.cwd);
                    break;
                case 'new-folder':
                    await interaction.showModal(
                        <Modal customId='new-folder' title='New Folder'>
                            <Label label='Folder Name'>
                                <TextInput customId='name' placeholder='Folder Name' style={TextInputStyle.Short} required={true}/>
                            </Label>
                        </Modal>
                    );
                    break;
                default:
                    const [_,index] = id.split(':');
                    if (_ !== 'open') break;

                    if (Number(index) === -1) {
                        this.cwd = path.dirname(this.cwd);
                    } else if (!isNaN(Number(index))) {
                        this.cwd = path.join(this.cwd, this.items[Number(index)]);
                    }

                    await interaction.deferUpdate();
                    await this.chdir(this.cwd);
                    await interaction.editReply(await this.createMessageData(options));
                    break;
            }
        });

        return promise;
    }

    public async chdir(dir: string): Promise<void> {
        this.cwd = dir;
        this.items = [];

        const items = await readdir(dir).catch(() => []);

        for (const item of items) {
            if (item.startsWith('.')) continue;

            const stats = await stat(path.join(dir, item));
            if (stats.isFile()) continue;

            this.items.push(item);
        }
    }

    public async createMessageData(options?: FolderSelector.MessageDataOptions): Promise<InteractionEditReplyOptions> {
        const pages: string[][] = [];
        const itemsPerPage: number = options?.itemsPerPage || 6;
        const currentPage: number = !options?.page || options.page > pages.length - 1 ? 0 : options.page;

        for (let i = 0; i < this.items.length; i += itemsPerPage) {
            pages.push(this.items.slice(i, i + itemsPerPage));
        }

        const items = pages[currentPage] ?? [];

        return {
            ...options?.base,
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <Container>
                    {options?.allowCreate
                        ? <Section>
                            <TextDisplay>## {options.title ?? 'Select a folder'}</TextDisplay>
                            <Button style={ButtonStyle.Primary} customId="new-folder" disabled={options.disabled}>New Folder</Button>
                        </Section>
                        : <TextDisplay>## {options?.title ?? 'Select a folder'}</TextDisplay>
                    }
                    <Separator/>
                    <Section>
                        <TextDisplay>📁 ../</TextDisplay>
                        <Button style={ButtonStyle.Secondary} customId={`open:-1`} disabled={options?.disabled}>Open</Button>
                    </Section>
                    {
                        items.map((item, index) => (
                            <Section>
                                <TextDisplay>📁 {item}</TextDisplay>
                                <Button style={ButtonStyle.Secondary} customId={`open:${index}`} disabled={options?.disabled}>Open</Button>
                            </Section>
                        ))
                    }
                </Container>
                <Container>
                    <TextDisplay>-# {this.cwd}</TextDisplay>
                    <ActionRow>
                        <Button style={ButtonStyle.Danger} customId="cancel" disabled={options?.disabled}>Cancel</Button>
                        <Button style={ButtonStyle.Success} customId="confirm" disabled={options?.disabled}>Select</Button>
                    </ActionRow>
                </Container>
            </>
        };
    }
}

export namespace FolderSelector {
    export interface Options {
        cwd: string;
        interaction: RepliableInteraction;
    }

    export interface MessageDataOptions {
        allowCreate?: boolean;
        page?: number;
        itemsPerPage?: number;
        title?: string;
        base?: InteractionEditReplyOptions;
        disabled?: boolean;
    }
}