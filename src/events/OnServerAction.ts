import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { BaseModule } from 'reciple';
import type { GlobalConfig } from '../utils/_GlobalConfig.js';
import KirinClient from '../kirin/KirinClient.js';
import type { Server } from '@kirinmc/core';
import type { ServerConfig } from '../utils/_ServerConfig.js';
import { inlineCode, MessageFlags, type RepliableInteraction } from 'discord.js';

export class OnServerAction extends BaseModule {
    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Button)
            .setFilter(i => i.customId.startsWith('server-action:'))
            .setExecute(async interaction => {
                const [action, serverId] = interaction.customId.split(':')[1].split(' ') as [GlobalConfig.ServerActionType, string];

                const server = KirinClient.kirin.get(serverId);
                const config = KirinClient.configurations.get(serverId);

                if (!server || !config) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: '❌ Server not found.'
                    });
                    return;
                }

                switch (action) {
                    case 'start':
                        await this.startInteraction(interaction, { server, config });
                        return;
                    case 'stop':
                        await this.stopInteraction(interaction, { server, config });
                        return;
                    case 'restart':
                        await this.restartInteraction(interaction, { server, config });
                        return;
                }
            })
            .toJSON()
    ];

    public async startInteraction(interaction: RepliableInteraction, options: OnServerAction.InteractionActionOptions) {
        const { server, config } = options;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply('❌ This interaction can only be used in a server with the bot in it.');
            return;
        }

        if (server.isRunning) {
            await interaction.editReply('❌ Server is already running.');
            return;
        }

        const hasPermission = await config.hasPermission({
            action: 'start',
            userId: interaction.user.id,
            channelId: interaction.channelId ?? undefined,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to start this server.');
            return;
        }

        await interaction.editReply('⌛ Server is starting...');
        await server.start().catch(() => null);

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server started successfully.`
                : `❌ Server failed to start.`
        }).catch(() => null);
    }

    public async stopInteraction(interaction: RepliableInteraction, options: OnServerAction.InteractionActionOptions) {
        const { server, config } = options;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply('❌ This interaction can only be used in a server with the bot in it.');
            return;
        }

        if (!server.isRunning) {
            await interaction.editReply('❌ Server is already stopped.');
            return;
        }

        const hasPermission = await config.hasPermission({
            action: 'stop',
            userId: interaction.user.id,
            channelId: interaction.channelId ?? undefined,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to stop this server.');
            return;
        }

        await interaction.editReply('⌛ Server is stopping...');

        const exitCode = await server.stop();

        await interaction.editReply({
            content: !exitCode
                ? `✅ Server stopped successfully.`
                : `❌ Server closed with exit code ${inlineCode(String(exitCode))}.`
        }).catch(() => null);
    }

    public async restartInteraction(interaction: RepliableInteraction, options: OnServerAction.InteractionActionOptions) {
        const { server, config } = options;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply('❌ This interaction can only be used in a server with the bot in it.');
            return;
        }

        if (!server.isRunning) {
            await interaction.editReply('❌ Server is not running.');
            return;
        }

        const hasPermission = await config?.hasPermission({
            action: 'restart',
            userId: interaction.user.id,
            channelId: interaction.channelId ?? undefined,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to restart this server.');
            return;
        }

        await interaction.editReply('⌛ Server is restarting...');
        await KirinClient.restart(server).catch(() => null);

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server restarted successfully.`
                : `❌ Server failed to restart.`
        }).catch(() => null);
    }
}

export namespace OnServerAction {
    export interface InteractionActionOptions {
        server: Server;
        config: ServerConfig;
    }
}

export default new OnServerAction();