import { InteractionListenerBuilder, InteractionListenerType } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { MessageFlags } from 'discord.js';
import { CodeBlock } from '@reciple/jsx';

export class SendCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('send')
        .setDescription('Sends a command to a server.')
        .addStringOption(command => command
            .setName('command')
            .setDescription('The command to send.')
            .setRequired(true)
        )
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerBuilder<InteractionListenerType>[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'send')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({ query, isRunning: true }),
                    level: 'global',
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');
        const command = interaction.options.getString('command', true);

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        const hasPermission = await KirinClient.config.hasPermission({
            action: 'manage',
            userId: interaction.user.id,
            guildId: interaction.guildId ?? undefined,
            channelId: interaction.channelId
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to use this command.');
            return;
        }

        await interaction.editReply({
            content: <CodeBlock>⏳ {command}</CodeBlock>
        });

        const sent = await server.send(command)
            .then(() => true)
            .catch(() => false);

        await interaction.editReply(
            <CodeBlock>{sent ? '✅' : '❌'} {command}</CodeBlock>
        );
    }
}

export default new SendCommand();