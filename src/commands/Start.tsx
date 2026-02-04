import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { MessageFlags } from 'discord.js';
import type { Output, Result } from 'tinyexec';

export class StartCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a server.')
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server to start.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'start')
            .setExecute(async interaction => {
                const servers = KirinClient.kirin.servers;
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    servers
                        .filter(s => !s.isRunning && (!query || s.id === query || s.name?.toLowerCase().includes(query)))
                        .map(s => ({
                            name: s.name || s.id,
                            value: s.id
                        }))
                        .splice(0, 25)
                )
            })
            .toJSON()
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const serverId = interaction.options.getString('server', true);
        const server = KirinClient.kirin.get(serverId);

        if (!server) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server not found.'
            });
            return;
        }

        if (server.isRunning) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server is already running.'
            });
            return;
        }

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: '⌛ Server is starting...'
        });

        let resolve: (process: Result, reason?: Output|Error) => void = () => null;
        const promise = new Promise(res => resolve = (process: Result, reason?: Output|Error) => {
            server.removeListener('processStart', resolve);
            server.removeListener('processStop', resolve);
            res(null);
        });

        server.once('processStart', resolve);
        server.once('processStop', resolve);

        await server.start();
        await promise;

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server started successfully.`
                : `❌ Server failed to start.`
        }).catch(() => null);
    }
}

export default new StartCommand();