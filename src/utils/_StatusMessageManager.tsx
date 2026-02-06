import { Colors, MessageFlags, type ContainerBuilder, type Message } from 'discord.js';
import type { ServerConfig } from './_ServerConfig.js';
import { Bold, CodeBlock, Container, Heading, LineBreak, Separator, SubText, TextDisplay } from '@reciple/jsx';
import type { Server } from '@kirinmc/core';

export class StatusMessageManager {
    public config: ServerConfig;

    get server() {
        return this.config.server;
    }

    constructor(config: ServerConfig) {
        this.config = config;
    }

    public async updateStatusMessage(): Promise<void> {
        const messages = await this.fetchStatusMessages();

        for (const message of messages) {
            await message.edit({
                flags: MessageFlags.IsComponentsV2,
                components: <>
                    {this.createStatusInfoContainer()}
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
}