import { MessageFlags } from 'discord.js';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';

export class ReloadCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads the server and global configurations.')
        .toJSON();

    public async execute(data: SlashCommand.ExecuteData) {
        const { interaction } = data;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply('❌ This command can only be used in a server with the bot in it.');
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

        await KirinClient.reloadConfigurations();

        await interaction.editReply('✅ Configurations reloaded successfully.');
    }
}

export default new ReloadCommand();