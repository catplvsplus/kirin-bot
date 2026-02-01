import { Server } from '@kirinmc/core';
import { ActionRow, Button, Container, FileUpload, Label, Modal, Section, Separator, StringSelectMenu, StringSelectMenuOption, TextDisplay, TextInput } from '@reciple/jsx';
import { ButtonStyle, ComponentType, inlineCode, TextInputStyle, type Attachment, type InteractionEditReplyOptions, type ModalBuilder, type ModalSubmitInteraction, type ReadonlyCollection, type RepliableInteraction } from 'discord.js';
import KirinClient from '../kirin/KirinClient.js';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import z from 'zod';

export class ServerSetup {
    public interaction: RepliableInteraction;
    public data: ServerSetup.Options['data'];
    public files: ReadonlyCollection<string, Attachment>|null = null;

    get isComplete() {
        return Server.schema.safeParse(this.data).success;
    }

    constructor(options: ServerSetup.Options) {
        this.interaction = options.interaction;
        this.data = options.data;
    }

    public async start(): Promise<Server.Data|null> {
        const message = await this.interaction.editReply(this.createMessageData());

        const componentCollector = message.createMessageComponentCollector({
            filter: interaction => interaction.user.id === this.interaction.user.id && (interaction.componentType === ComponentType.Button || interaction.componentType === ComponentType.StringSelect),
            time: 1000 * 60 * 5
        });

        let handleConfirm: (value: Server.Data|null) => void;
        let promise = new Promise<Server.Data|null>(resolve => handleConfirm = resolve);

        componentCollector.on('collect', async interaction => {
            const id = interaction.customId as 'cancel'|'finish'|'setup-software'|'ping-interval'|'toggle-persist';

            switch (id) {
                case 'setup-software':
                    await interaction.showModal(this.createModal());

                    const modalInteraction = await interaction.awaitModalSubmit({ time: 1000 * 60 * 5 }).catch(() => null);
                    if (!modalInteraction) break;

                    this.handleSetupSoftwareModal(modalInteraction);
                    break;
                case 'ping-interval':
                    const interval = Number(interaction.isStringSelectMenu() && interaction.values[0]);
                    if (isNaN(interval)) break;

                    this.data.pingInterval = interval;

                    await interaction.deferUpdate();
                    await interaction.editReply(this.createMessageData());
                    break;
                case 'cancel':
                    await interaction.deferUpdate();
                    componentCollector.stop();
                    handleConfirm(null);
                    break;
                case 'toggle-persist':
                    this.data.persist = !this.data.persist;

                    await interaction.deferUpdate();
                    await interaction.editReply(this.createMessageData());
                    break;
                case 'finish':
                    if (this.isComplete) {
                        componentCollector.stop();
                        handleConfirm(this.data as Server.Data);
                        break;
                    }

                    await interaction.reply({
                        content: `Server setup is not complete. Please fix the following fields: ${this.getErroredFields().map(f => inlineCode(f)).join(' ')}`,
                        ephemeral: true
                    });
                    break;
            }
        });

        componentCollector.on('end', async () => {
            await this.interaction.editReply(this.createMessageData({
                disabled: true
            }));
        });

        return promise;
    }

    public async createServer(): Promise<Server> {
        if (!this.isComplete) throw new Error('Server setup is not complete.');

        if (this.files) {
            await Promise.all(
                this.files.map(async file => {
                    const fullPath = path.join(KirinClient.kirin.root, this.data.directory, file.name);

                    const stats = await stat(fullPath).catch(() => null);
                    if (stats) return;

                    const response = await fetch(file.url);
                    if (!response.ok || !response.body) return;

                    await mkdir(path.dirname(fullPath), { recursive: true });

                    const writeStream = createWriteStream(fullPath);

                    for await (const chunk of response.body) {
                        writeStream.write(chunk);
                    }

                    writeStream.end();
                })
            )
        }

        return KirinClient.kirin.add(this.data as Server.Data);
    }

    public createMessageData(options?: ServerSetup.CreateMessageDataOptions): InteractionEditReplyOptions {
        const isSoftwareConfigured = this.data.command && this.data.address && this.data.directory;

        return {
            ...options?.base,
            components: <>
                <Container>
                    <TextDisplay>## {this.data.name}</TextDisplay>
                    <Separator/>
                    <Section>
                        <TextDisplay>
                            {'### Software Setup\n'}
                            {'-# Configures the server software, start command, address, and env variables of the server.'}
                        </TextDisplay>
                        <Button
                            style={isSoftwareConfigured ? ButtonStyle.Secondary : ButtonStyle.Primary}
                            customId='setup-software'
                            disabled={options?.disabled}
                        >
                            {isSoftwareConfigured ? 'Edit' : 'Setup'}
                        </Button>
                    </Section>
                    <Section>
                        <TextDisplay>
                            {'### Persistent Process\n'}
                            {'-# Persistent process means that the server will be kept running even if the bot went offline.'}
                        </TextDisplay>
                        <Button
                            style={ButtonStyle.Secondary}
                            customId='toggle-persist'
                            disabled={options?.disabled}
                        >
                            {this.data.persist ? 'Disable' : 'Enable'}
                        </Button>
                    </Section>
                    <TextDisplay>### Ping Interval</TextDisplay>
                    <ActionRow>
                        <StringSelectMenu customId='ping-interval' placeholder='Select Ping Interval' disabled={options?.disabled}>
                            {
                                Object.entries(ServerSetup.DefaultPingIntervals).map(([name, value]) => (
                                    <StringSelectMenuOption
                                        label={name}
                                        value={value.toString()}
                                        default={this.data.pingInterval === value}
                                    />
                                ))
                            }
                        </StringSelectMenu>
                    </ActionRow>
                    <TextDisplay>-# Ping interval is how often the bot pings the server to check if it's online.</TextDisplay>
                    <Separator/>
                    <ActionRow>
                        <Button style={ButtonStyle.Danger} customId='cancel' disabled={options?.disabled}>Cancel</Button>
                        <Button style={ButtonStyle.Success} customId='finish' disabled={options?.disabled}>Create Server</Button>
                    </ActionRow>
                </Container>
            </>
        };
    }

    public async handleSetupSoftwareModal(interaction: ModalSubmitInteraction): Promise<void> {
        this.files = interaction.fields.getUploadedFiles('server-executable');

        const startCommand = interaction.fields.getTextInputValue('start-command');
        const env = interaction.fields.getTextInputValue('environment-variables');
        const serverAddress = interaction.fields.getTextInputValue('server-address');

        this.data.command = startCommand;
        this.data.address = serverAddress;

        if (ServerSetup.isEnvContent(env)) {
            this.data.env = {};

            for (const line of env.split('\n')) {
                const [key, value] = line.split('=');
                this.data.env[key] = ServerSetup.stripQuotes(value);
            }
        } else {
            this.data.env = env;
        }

        await interaction.deferUpdate();
        await interaction.editReply(this.createMessageData());
    }

    public createModal(): ModalBuilder {
        return (
            <Modal customId='setup-software' title='Server Software Setup'>
                <Label
                    label='Server Executable'
                    description='This is the file that will be used to run the server. (Can be a .jar or .exe file)'
                >
                    <FileUpload
                        customId='server-executable'
                        maxValues={1}
                        required={false}
                    />
                </Label>
                <Label
                    label='Start Command'
                    description='This is the command that will be executed to start the server.'
                >
                    <TextInput
                        customId='start-command'
                        style={TextInputStyle.Paragraph}
                        placeholder='java -jar server.jar'
                        value={this.data.command}
                        required={true}
                    />
                </Label>
                <Label
                    label='Server Address'
                    description='This is the address that will be used to ping the server.'
                >
                    <TextInput
                        customId='server-address'
                        style={TextInputStyle.Short}
                        placeholder='127.0.0.1:25565'
                        value={this.data.address ?? `localhost:${this.data.type === 'java' ? 25565 : 19132}`}
                        required={true}
                    />
                </Label>
                <Label
                    label='Environment Variables'
                    description='Environment variables that will be set to the server process. (This can be a path to a .env file)'
                >
                    <TextInput
                        customId='environment-variables'
                        style={TextInputStyle.Paragraph}
                        placeholder='KEY1=VALUE1\nKEY2=VALUE2'
                        value={
                            typeof this.data.env === 'string'
                                ? this.data.env
                                : Object.entries(this.data.env ?? {}).map(([key, value]) => `${key}=${value}`).join('\n')
                        }
                        required={false}
                    />
                </Label>
            </Modal>
        );
    }

    public getErroredFields(): string[] {
        const data = Server.schema.safeParse(this.data);
        if (data.success) return [];

        const errors = z.flattenError(data.error);

        return Object.keys(errors.fieldErrors);
    }
}

export namespace ServerSetup {
    export interface Options {
        interaction: RepliableInteraction;
        data: Data;
    }

    export type Data = Partial<Omit<Server.Data, 'id'|'name'|'type'|'directory'|'persist'>> & {
        id: string;
        name: string;
        type: Server.Type;
        directory: string;
        persist: boolean;
    };

    export interface CreateMessageDataOptions {
        base?: InteractionEditReplyOptions;
        disabled?: boolean;
    }

    export const DefaultPingIntervals = {
        '1 minute': 60 * 1000,
        '3 minutes': 3 * 60 * 1000,
        '5 minutes': 5 * 60 * 1000,
        '10 minutes': 10 * 60 * 1000,
        '30 minutes': 30 * 60 * 1000,
        '1 hour': 60 * 60 * 1000
    }

    export function isEnvContent(content: string): boolean {
        return content.split('\n').every(line => line.includes('='));
    }

    export function stripQuotes(content: string): string {
        if (content.startsWith('"') && content.endsWith('"')) {
            return content.slice(1, -1);
        } else if (content.startsWith("'") && content.endsWith("'")) {
            return content.slice(1, -1);
        } else {
            return content;
        }
    }
}