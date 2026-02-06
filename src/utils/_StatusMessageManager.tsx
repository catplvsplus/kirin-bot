import { ButtonStyle, Colors, MessageFlags, type ButtonBuilder, type ContainerBuilder, type Message } from 'discord.js';
import type { ServerConfig } from './_ServerConfig.js';
import { ActionRow, Bold, Button, CodeBlock, Container, Heading, LineBreak, Separator, SubText, TextDisplay } from '@reciple/jsx';
import type { Server } from '@kirinmc/core';
import type { GlobalConfig } from './_GlobalConfig.js';

export class StatusMessageManager {
    public config: ServerConfig;

    get server() {
        return this.config.server;
    }

    constructor(config: ServerConfig) {
        this.config = config;
    }

    public async updateStatusMessage(disabled?: boolean): Promise<void> {
        const messages = await this.fetchStatusMessages();

        for (const message of messages) {
            const config = this.config.statusMessages.find(m => m.messageId === message.id);
            if (!config) continue;

            await message.edit({
                flags: MessageFlags.IsComponentsV2,
                components: <>
                    {this.createStatusInfoContainer()}
                    {
                        config.allowedActions.length
                            ? <ActionRow>
                                {StatusMessageManager.createActionButtons(
                                    config.allowedActions,
                                    { server: this.server, disabled }
                                )}
                            </ActionRow>
                            : undefined
                    }
                </>
            }).catch(() => null);
        }
    }

    public async fetchStatusMessages(): Promise<Message[]> {
        const messages: Message[] = [];

        for (const data of this.config.statusMessages) {
            const channel = await useClient().channels.fetch(data.channelId);
            if (!channel || !channel.isTextBased()) continue;

            const message = await channel.messages.fetch(data.messageId).catch(() => null);
            if (!message) continue;

            messages.push(message);
        }

        return messages;
    }

    public createStatusInfoContainer(): ContainerBuilder {
        return (
            <Container accentColor={this.server.ping.latest?.status === 'online' ? Colors.Green : Colors.DarkButNotBlack}>
                <TextDisplay>
                    <Heading level={3}>{this.server.name || this.server.id}</Heading>
                </TextDisplay>
                {
                    this.server.ping.latest?.motd
                    ? <>
                        <Separator/>
                        <TextDisplay>{this.server.ping.latest.motd.replace(/§[0-9A-FK-OR]/gi, '')}</TextDisplay>
                    </>
                    : undefined
                }
                <TextDisplay>
                    {
                        this.server.ping.latest?.status === 'online'
                            ? <CodeBlock>{this.server.address}</CodeBlock>
                            : undefined
                    }
                    <LineBreak/>
                    <SubText>
                        {StatusMessageManager.getStatusEmoji(this.server.status)} <Bold>{this.server.status}</Bold> | {this.server.type.slice(0, 1).toUpperCase() + this.server.type.slice(1)} server
                    </SubText>
                </TextDisplay>
            </Container>
        );
    }
}

export namespace StatusMessageManager {
    export function getStatusEmoji(status: Server.Status): string {
        switch (status) {
            case 'online':
                return '🟢';
            case 'offline':
                return '🔴';
            case 'stopping':
                return '🟠';
            case 'starting':
                return '🟡';
            default:
                return '⚫';
        }
    }

    export interface CreateActionButtonsOptions {
        server: Server;
        disabled?: boolean;
    }

    export function createActionButtons(actions: GlobalConfig.ServerActionType[], options: CreateActionButtonsOptions): ButtonBuilder[] {
        return actions.map(action => <Button
            style={
                action === 'start'
                    ? ButtonStyle.Success
                    : action === 'stop'
                        ? ButtonStyle.Danger
                        : ButtonStyle.Secondary
            }
            customId={`server-action:${action} ${options.server.id}`}
            disabled={options.disabled ?? isActionDisabled(action, options.server.status)}
        >
            {action.slice(0, 1).toUpperCase() + action.slice(1)}
        </Button>
        )
    }

    export function isActionDisabled(action: GlobalConfig.ServerActionType, status: Server.Status): boolean {
        switch (status) {
            case 'online':
                return action === 'start';
            case 'offline':
                return action === 'stop' || action === 'restart';
            case 'starting':
                return action === 'start' || action === 'restart';
            case 'stopping':
            case 'detached':
                return true;
        }
    }
}