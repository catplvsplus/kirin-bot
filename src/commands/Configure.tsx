import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { ServerSetup } from '../utils/_ServerSetup.js';
import { Colors, inlineCode, MessageFlags } from 'discord.js';
import { Container, Heading, LineBreak, SubText, TextDisplay } from '@reciple/jsx';

export class Configure extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('configure')
        .setDescription('Configure a server.')
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
                const servers = KirinClient.kirin.servers;
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    servers
                        .filter(s => !query || s.id === query || s.name?.toLowerCase().includes(query))
                        .map(s => ({
                            name: s.name || s.id,
                            value: s.id
                        }))
                        .splice(0, 25)
                )
            })
            .toJSON(),
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));

        if (!server) {
            await interaction.reply({
                content: '❌ Server not found.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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