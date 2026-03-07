import { Collection, type AnyThreadChannel, type GuildTextBasedChannel, type Webhook } from 'discord.js';

export class WebhookManager {
    public webhooks: Collection<string, Webhook|null> = new Collection();

    public async resolveWebhook(channel: Exclude<GuildTextBasedChannel, AnyThreadChannel>): Promise<Webhook|null> {
        if (this.webhooks.has(channel.id)) return this.webhooks.get(channel.id)!;
        if (!channel.permissionsFor(useClient().user!)?.has('ManageWebhooks')) return null;

        let webhook: Webhook|null = (await channel.fetchWebhooks()).find(w => w.owner?.id === useClient().user?.id) ?? null;
            webhook ??= await channel.createWebhook({
                name: useClient().user?.displayName ?? 'Kirin',
                avatar: useClient().user?.displayAvatarURL()
            });

        this.webhooks.set(channel.id, webhook);

        return webhook;
    }
}