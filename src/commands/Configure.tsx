import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { ServerSetup } from '../utils/_ServerSetup.js';
import { Colors, inlineCode, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Container, Heading, LineBreak, SubText, TextDisplay } from '@reciple/jsx';

export class Configure extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('configure')
        .setDescription('Configure a server.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'configure')
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
            .toJSON(),
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        if (!interaction.inCachedGuild()) {
            await interaction.reply('❌ This command can only be used in a server with the bot in it.');
            return;
        }

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        if (!server || !config) {
            await interaction.reply({
                content: '❌ Server not found.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

        const setup = new ServerSetup({
            interaction,
            data: server.toJSON(),
            disableFileUpload: true
        });

        if (!await setup.start()) return;

        await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <TextDisplay>⌛ Applying changes...</TextDisplay>
            </>
        });

        await setup.apply();

        await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <TextDisplay>✅ Your server has been updated!</TextDisplay>
                <Container accentColor={Colors.Green}>
                    <TextDisplay>
                        <Heading level={2}>{server.name}</Heading>
                        <LineBreak/>
                        <SubText>Id: {inlineCode(server.id)}</SubText>
                        <LineBreak/>
                        <SubText>Type: {inlineCode(server.type)}</SubText>
                        <LineBreak/>
                        <SubText>Address: {inlineCode(server.address)}</SubText>
                    </TextDisplay>
                    {
                        server.isRunning
                            ? <>
                                <LineBreak/>
                                <SubText>⚠️ Server changes will be applied on next restart.</SubText>
                            </>
                            : undefined
                    }
                </Container>
            </>
        });
    }
}

export default new Configure();