import { ActionRow, Button, Container, Heading, Label, Modal, Section, Separator, StringSelectMenu, StringSelectMenuOption, SubText, TextDisplay, TextInput } from '@reciple/jsx';
import { ButtonStyle, ComponentType, MessageFlags, TextInputStyle, type InteractionEditReplyOptions, type RepliableInteraction } from 'discord.js';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export class FolderSelector {
    public cwd: string;
    public interaction: RepliableInteraction;

    public items: string[] = [];
    public itemsPerPage: number = 6;
    public page: number = 0;

    get pages() {
        const pages: string[][] = [];

        for (let i = 0; i < this.items.length; i += this.itemsPerPage) {
            pages.push(this.items.slice(i, i + this.itemsPerPage));
        }

        return pages;
    }

    get currentPage() {
        return this.pages[this.page > this.pages.length - 1 ? this.pages.length - 1 : this.page] ?? [];
    }

    constructor(options: FolderSelector.Options) {
        this.cwd = options.cwd;
        this.interaction = options.interaction;
    }

    public async start(options?: FolderSelector.MessageDataOptions): Promise<string|null> {
        await this.chdir(this.cwd);

        const message = await this.interaction.editReply(await this.createMessageData(options));

        const componentCollector = message.createMessageComponentCollector({
            filter: interaction => interaction.user.id === this.interaction.user.id && (interaction.componentType === ComponentType.Button || interaction.componentType === ComponentType.StringSelect),
            time: 1000 * 60 * 5
        });

        let handleConfirm: (value: string|null) => void;
        let promise = new Promise<string|null>(resolve => handleConfirm = resolve);

        componentCollector.on('collect', async interaction => {
            const id = interaction.customId as 'new-folder'|`open:${number}`|'set-page'|'cancel'|'confirm';

            switch (id) {
                case 'cancel':
                    await interaction.deferUpdate();
                    componentCollector.stop();
                    handleConfirm(null);
                    break;
                case 'confirm':
                    await interaction.deferUpdate();
                    componentCollector.stop();
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

                    const newFolderModal = await interaction.awaitModalSubmit({ time: 1000 * 60 * 5 }).catch(() => null);
                    if (!newFolderModal) break;

                    const folder = newFolderModal.fields.getTextInputValue('name');

                    if (!FolderSelector.isValidFolderName(folder)) {
                        await newFolderModal.reply({
                            content: 'Invalid folder name.',
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }

                    await newFolderModal.deferUpdate();
                    await this.mkdir(folder);
                    await interaction.editReply(await this.createMessageData(options));
                    break;
                case 'set-page':
                    const page = Number(interaction.isStringSelectMenu() && interaction.values[0]);
                    if (isNaN(page)) break;

                    this.page = page;

                    await interaction.deferUpdate();
                    await interaction.editReply(await this.createMessageData(options));
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

        componentCollector.on('end', async () => {
            await this.interaction.editReply(await this.createMessageData({
                ...options,
                disabled: true
            }));
        })

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
            this.page = 0;
        }
    }

    public async mkdir(name: string): Promise<void> {
        const fullPath = path.join(this.cwd, name);

        await mkdir(fullPath);
    }

    public async createMessageData(options?: FolderSelector.MessageDataOptions): Promise<InteractionEditReplyOptions> {
        return {
            ...options?.base,
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <Container>
                    {options?.allowCreate
                        ? <Section>
                            <TextDisplay>
                                <Heading level={2}>{options.title ?? 'Select a folder'}</Heading>
                            </TextDisplay>
                            <Button style={ButtonStyle.Primary} customId="new-folder" disabled={options.disabled}>New Folder</Button>
                        </Section>
                        : <TextDisplay>
                            <Heading level={2}>{options?.title ?? 'Select a folder'}</Heading>
                        </TextDisplay>
                    }
                    <Separator/>
                    <Section>
                        <TextDisplay>📁 ../</TextDisplay>
                        <Button style={ButtonStyle.Secondary} customId={`open:-1`} disabled={options?.disabled}>Open</Button>
                    </Section>
                    {
                        this.currentPage.map((item, index) => (
                            <Section>
                                <TextDisplay>📁 {item}</TextDisplay>
                                <Button style={ButtonStyle.Secondary} customId={`open:${index}`} disabled={options?.disabled}>Open</Button>
                            </Section>
                        ))
                    }
                    {
                        this.pages.length > 1
                            ? <>
                                <Separator/>
                                <ActionRow>
                                    <StringSelectMenu customId='set-page' placeholder='Select Page' disabled={options?.disabled}>
                                        {
                                            this.pages
                                                .splice(0, 25)
                                                .map((_, index) => (
                                                <StringSelectMenuOption label={`Page ${index + 1}`} value={index.toString()} default={this.page === index}/>
                                            ))
                                        }
                                    </StringSelectMenu>
                                </ActionRow>
                            </>
                            : undefined
                    }
                </Container>
                <Container>
                    <TextDisplay>
                        <SubText>{this.cwd}</SubText>
                    </TextDisplay>
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
    const folderNameRegex = /^[^\s^\x00-\x1f\\?*:"";<>|\/.][^\x00-\x1f\\?*:"";<>|\/]*[^\s^\x00-\x1f\\?*:"";<>|\/.]+$/g;

    export interface Options {
        cwd: string;
        interaction: RepliableInteraction;
    }

    export interface MessageDataOptions {
        allowCreate?: boolean;
        title?: string;
        base?: InteractionEditReplyOptions;
        disabled?: boolean;
    }

    export function isValidFolderName(name: string): boolean {
        return !!name.length && folderNameRegex.test(name);
    }
}