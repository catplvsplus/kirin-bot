import { InteractionListenerBuilder, InteractionListenerType } from '@reciple/modules';
import { ButtonStyle, Colors, ComponentType, MessageFlags } from 'discord.js';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { ActionRow, Button, CodeBlock, Container, Heading, InlineCode, LineBreak, TextDisplay } from '@reciple/jsx';
import { FolderSelector } from '../utils/_FolderSelector.js';
import path from 'node:path';
import { Format } from '@reciple/utils';

export class DownloadCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('download')
        .setDescription('Download a file from URL to server directory.')
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(url => url
            .setName('url')
            .setDescription('The downloadable URL of the file.')
            .setRequired(true)
        )
        .addStringOption(name => name
            .setName('name')
            .setDescription('The name of the file.')
            .setRequired(false)
        )
        .addStringOption(sha256 => sha256
            .setName('sha256')
            .setDescription('The SHA256 hash of the file. Used to verify file integrity.')
            .setRequired(false)
        )
        .toJSON();

    public interactions: InteractionListenerBuilder<InteractionListenerType>[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'download')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({ query }),
                    action: 'manage',
                    userId: interaction.user.id,
                    guildId: interaction.guildId ?? undefined,
                    channelId: interaction.channelId
                });

                await interaction.respond(
                    servers
                        .map(s => ({ name: s.name || s.id, value: s.id }))
                        .splice(0, 25)
                );
            })
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const url = this.parseURL(interaction.options.getString('url', true));
        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!url) {
            await interaction.editReply('❌ Invalid URL.');
            return;
        }

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        const hasPermission = await config.hasPermission({
            action: 'manage',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to manage this server.');
            return;
        }

        if (!this.isTrusted(url)) {
            const message = await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: <>
                    <Container accentColor={Colors.Red}>
                        <TextDisplay>
                            <Heading level={2}>⚠️ Attention!</Heading>
                            <LineBreak/>
                            You are about to download a file from an untrusted source (<InlineCode>{url.host}</InlineCode>). This could potentially be a malicious file. Are you sure you want to continue?
                            <LineBreak/>
                            <CodeBlock>{url.toString()}</CodeBlock>
                        </TextDisplay>
                        <ActionRow>
                            <Button style={ButtonStyle.Secondary} customId='cancel'>Cancel</Button>
                            <Button style={ButtonStyle.Danger} customId='continue'>Continue</Button>
                        </ActionRow>
                    </Container>
                </>
            });

            const response = await message.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                componentType: ComponentType.Button,
                time: 15000
            }).catch(() => null);

            await response?.deferUpdate();

            if (!response || response?.customId === 'cancel') {
                await interaction.editReply({
                    flags: [MessageFlags.IsComponentsV2],
                    components: <>
                        <TextDisplay>❌ Operation cancelled.</TextDisplay>
                    </>
                });
                return;
            }
        }

        const filename = interaction.options.getString('name');
        const sha256 = interaction.options.getString('sha256');

        const dirSelector = new FolderSelector({
            cwd: path.join(KirinClient.kirin.root, server.directory),
            allowPastCwd: false,
            interaction
        });

        const directory = await dirSelector.start({
            title: 'Select download location',
            allowCreate: true,
        });

        if (!directory) return;

        await interaction.editReply({
            components: <>
                <TextDisplay>⏳ Downloading file...</TextDisplay>
            </>
        });

        try {
            let lastUpdated = Date.now();

            const location = await KirinClient.kirin.downloads.download(url.toString(), {
                directory,
                filename: filename ?? undefined,
                checksum: sha256
                    ? {
                        type: 'sha256',
                        hash: sha256
                    } : undefined,
                onProgress: progress => {
                    if (Date.now() - lastUpdated > 1000) {
                        const percent = progress.size ? Math.round((progress.progress / progress.size) * 100) : null;

                        lastUpdated = Date.now();
                        interaction.editReply({
                            components: <>
                                <TextDisplay>⏳ Downloading file <InlineCode>{percent ? `${percent}%` : `${Format.bytes(progress.progress)}`}</InlineCode></TextDisplay>
                            </>
                        }).catch(() => null);
                    }
                }
            });

            await interaction.editReply({
                components: <>
                    <TextDisplay>✅ File downloaded successfully as <InlineCode>{path.basename(location)}</InlineCode>.</TextDisplay>
                </>
            });
        } catch (err) {
            KirinClient.logger.error(err);

            await interaction.editReply({
                components: <>
                    <TextDisplay>
                        ❌ {err instanceof Error ? err.message : String(err)}
                        <LineBreak/>
                    </TextDisplay>
                </>
            });
            return;
        }
    }

    public parseURL(url: string): URL|null {
        try {
            return new URL(url);
        } catch {
            return null;
        }
    }

    public isTrusted(url: URL): boolean {
        return DownloadCommand.trustedHosts.includes(url.host.toLowerCase());
    }
}

export namespace DownloadCommand {
    export const trustedHosts = [
        'raw.githubusercontent.com',
        'github.com',
        'www.spigotmc.org',
        'fill-data.papermc.io',
        'cdn.modrinth.com',
        'mediafilez.forgecdn.net',
        'server-jar.org'
    ];
}

export default new DownloadCommand();