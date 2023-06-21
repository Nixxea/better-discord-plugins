/**
 * @name BetterModeration
 * @author Nixea
 * @version 0.1.0
 * @description Добавляет команды для удобства модерации
 */

const { Webpack, Plugins } = BdApi;
const { Filters, getModule } = Webpack;

const MAX_TIMEOUT_TIME = 2419200000;

const timeTriggers = {
    мес: 2592000000,
    mo: 2592000000,
    с: 1000,
    м: 60000,
    ч: 3600000,
    д: 86400000,
    н: 604800000,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000
};

module.exports = class BetterModeration {
    constructor(meta) {
        this.name = 'BetterModeration';
        this.commandsLibrary = null;
        this.commands = [];

        this.modules = {
            Permissions: getModule(Filters.byProps('Pl', 'zM')).Pl,
            ApplicationCommandConstants: getModule(Filters.byProps('jw', 'B8')),
            moderation: getModule(Filters.byProps('setCommunicationDisabledUntil')),
            messages: getModule(Filters.byProps('sendBotMessage')),
            users: getModule(Filters.byProps('getUsers')),
            permissions: getModule(Filters.byProps('canManageUser')),
            canTimeout: getModule(m => typeof m.Z === 'function' && typeof m.F === 'function').F,
            saveChannel: getModule(Filters.byProps('saveChannel')).saveChannel
        }
    }

    start() {
        this.commandsLibrary = Plugins.get('CommandsLibrary')?.instance;

        if (!this.commandsLibrary?.loaded) {
            BdApi.showToast('Нужно сначала включить CommandsLibrary');
            Plugins.disable(this.name);
            return;
        }

        const Messages = this.modules.messages;
        const Moderation = this.modules.moderation;
        const UserStore = this.modules.users;
        const PermissionStore = this.modules.permissions;
        const canTimeout = this.modules.canTimeout;
        const saveChannel = this.modules.saveChannel;
        const Permissions = this.modules.Permissions;
        const { jw: ApplicationCommandOptionType, yU: ApplicationCommandType } = this.modules.ApplicationCommandConstants;

        this.registerCommand({
            name: 'mute',
            displayName: 'mute',
            description: 'Time out member.',
            displayDescription: 'Time out member.',
            options: [
                {
                    name: 'member',
                    displayName: 'member',
                    description: 'The member to time out',
                    displayDescription: 'The member to time out',
                    required: true,
                    type: ApplicationCommandOptionType.USER
                },
                {
                    name: 'time',
                    displayName: 'time',
                    description: 'Time out time or date',
                    displayDescription: 'Time out time or date',
                    required: true,
                    type: ApplicationCommandOptionType.STRING
                },
                {
                    name: 'reason',
                    displayName: 'reason',
                    description: 'The reason for time out',
                    displayDescription: 'The reason for time out',
                    required: false,
                    type: ApplicationCommandOptionType.STRING
                }
            ],
            type: ApplicationCommandType.CHAT,
            predicate(ctx) {
                return PermissionStore.can(Permissions.MODERATE_MEMBERS, ctx.guild);
            },
            async execute(args, ctx) {
                const userId = args.find(a => a.name === 'member').value;
                const timeString = args.find(a => a.name === 'time').value;
                const reason = args.find(a => a.name === 'reason')?.value;

                const user = UserStore.getUser(userId);
                if (!canTimeout(ctx.guild.id, userId)) return Messages.sendBotMessage(ctx.channel.id, 'You cannot time out this member.');

                let time = BetterModeration.getTime(timeString);
                if (!time) return Messages.sendBotMessage(ctx.channel.id, `Seems like \`${timeString}\` is not a valid time string.\nFor example: \`1h30m\` or \`1hour 10m\``);

                time = Math.min(MAX_TIMEOUT_TIME, time);
                const timestamp = Date.now() + time;
                const unixTimestamp = timestamp / 1000 | 0;
                
                Moderation.setCommunicationDisabledUntil(ctx.guild.id, userId, new Date(Date.now() + time).toISOString(), null, reason);

                const replyText = `**${user?.tag || userId}** has been timed out for <t:${unixTimestamp}:R>, <t:${unixTimestamp}:d> <t:${unixTimestamp}:T>`;
                Messages.sendBotMessage(ctx.channel.id, replyText);
            }
        });

        this.registerCommand({
            name: 'slowmode',
            displayName: 'slowmode',
            description: 'Set slowmode on the channel.',
            displayDescription: 'Set slowmode on the channel.',
            options: [
                {
                    name: 'time',
                    displayName: 'time',
                    description: 'Time out time or date',
                    displayDescription: 'Time out time or date',
                    required: true,
                    type: ApplicationCommandOptionType.STRING
                },
                {
                    name: 'channel',
                    displayName: 'channel',
                    description: 'The reason for time out',
                    displayDescription: 'The reason for time out',
                    required: false,
                    type: ApplicationCommandOptionType.CHANNEL
                }
            ],
            type: ApplicationCommandType.CHAT,
            predicate(ctx) {
                return PermissionStore.can(Permissions.MANAGE_CHANNELS, ctx.channel);
            },
            async execute(args, ctx) {
                const channelId = args.find(a => a.name === 'channel')?.value || ctx.channel.id;
                const timeString = args.find(a => a.name === 'time').value;

                let time = BetterModeration.parseTime(timeString) / 1000 | 0;
                if (typeof time !== 'number') return Messages.sendBotMessage(ctx.channel.id, `Seems like \`${timeString}\` is not a valid time string.\nFor example: \`1h30m\` or \`1hour 10m\``);
                time = Math.min(21600, time);

                saveChannel(channelId, { rateLimitPerUser: time });

                const replyText = `Slowmode for the channel has been set to \`${time}\` seconds.`;
                Messages.sendBotMessage(ctx.channel.id, replyText);
            }
        });
    }

    registerCommand(command) {
        this.commands.push(this.commandsLibrary.registerCommand(command));
    }

    stop() {
        for (const unload of this.commands) {
            unload();
        }

        this.commands = [];
    }

    static parseTime(text) {
        let time = 0;
        const matches = text.matchAll(/((?:\d+\.)?\d+) ?([^\d\s.]+)/g);
    
        for (const match of matches) {
            const [, value, unit] = match;
    
            let modifier;
            for (const modifierName in timeTriggers) {
                if (unit.startsWith(modifierName)) {
                    modifier = timeTriggers[modifierName];
                    break;
                }
            }
    
            if (!modifier) continue;
            time += modifier * value;
        }
    
        return time ?? null;
    }

    static parseDate(text) {
    const matched = text.match(/^(?:(\d{1,2})\.(\d{1,2})(?:\.(\d{1,4}))?)?(?:(?:\s|-| в | in )?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (!matched || !matched[0]) return null;

    const now = new Date();
    const target = new Date(1970, 0);
    let [, day, month, year, hour, minute, second] = matched;

    target.setFullYear(+year || now.getFullYear());
    target.setMonth(+month ? month - 1 : now.getMonth());
    target.setDate(+day || now.getDate());

    if (hour) {
        target.setHours(+hour);
        target.setMinutes(+minute);
        target.setSeconds(+second || 0);
    }

    return target;
}

    static getTime(text) {
        const parsedTime = BetterModeration.parseTime(text);
        if (parsedTime) return parsedTime;
    
        const parsedDate = BetterModeration.parseDate(text);
        if (parsedDate) return parsedDate.getTime() - Date.now();
    
        return null;
    }
};