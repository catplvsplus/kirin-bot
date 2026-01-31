import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { inlineCode, InteractionContextType, MessageFlags } from 'discord.js';
import type { Server } from '@kirinmc/core';
import { slug } from 'github-slugger';
import { FolderSelector } from '../utiks/_FolderSelector.js';
import path from 'node:path';

export class CreateCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create a new server.')
        .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        )
        .addStringOption(id => id
            .setName('id')
            .setDescription('The id of the server (must be unique)')
            .setRequired(true)
        )
        .addStringOption(name => name
            .setName('name')
            .setDescription('The name of the server')
            .setRequired(true)
        )
        .addStringOption(description => description
            .setName('type')
            .setDescription('The type of the server')
            .addChoices(
                { name: 'Java Edition', value: 'java' },
                { name: 'Bedrock Edition', value: 'bedrock' }
            )
            .setRequired(true)
        )
        .toJSON();

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const server: Partial<Server.Data> & { id: string; name: string; type: Server.Type; } = {
            id: slug(interaction.options.getString('id', true), false),
            name: interaction.options.getString('name', true),
            type: interaction.options.getString('type', true) as Server.Type
        };

        if (KirinClient.kirin.get(server.id)) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `A server with an id ${inlineCode(server.id)} already exists.`,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const selectFolder = new FolderSelector({
            cwd: path.resolve(KirinClient.kirin.root),
            interaction
        });

        await selectFolder.select();
    }
}

export default new CreateCommand();