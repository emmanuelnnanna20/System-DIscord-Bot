require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ============================================
// XP STORAGE
// ============================================
const userXP = {};
const userWarnings = {};
const userStreaks = {};

// ============================================
// RANK SYSTEM
// ============================================
const ranks = [
    'E Rank Hunter',
    'D Rank Hunter',
    'C Rank Hunter',
    'B Rank Hunter',
    'S Rank Hunter'
];

const rankThresholds = [0, 500, 1500, 3000, 6000];

// ============================================
// BOT READY
// ============================================
client.once('ready', () => {
    console.log(`✅ The System is online as ${client.user.tag}`);
    startScheduledPosts();
});

// ============================================
// WELCOME NEW MEMBERS
// ============================================
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeChannel = member.guild.channels.cache
            .find(ch => ch.name === 'introductions');

        if (welcomeChannel) {
            await welcomeChannel.send(
                `⚔️ **A new hunter has entered the server.**\n\n` +
                `Welcome **${member.user.username}**!\n` +
                `You have been assigned **E Rank Hunter**.\n\n` +
                `Your journey begins now.\n` +
                `Head to <#${welcomeChannel.id}> and tell us:\n` +
                `• Your name\n` +
                `• Your first quest\n` +
                `• What you are leveling up\n\n` +
                `The system is watching. **Arise.** 🔥`
            );
        }

        const role = member.guild.roles.cache
            .find(r => r.name === 'E Rank Hunter');
        if (role) await member.roles.add(role);

    } catch (err) {
        console.error('Welcome error:', err);
    }
});

// ============================================
// XP SYSTEM & AUTO RANK UP
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const guild = message.guild;

    // Give XP
    if (!userXP[userId]) userXP[userId] = 0;
    userXP[userId] += 10;

    const currentXP = userXP[userId];

    // Check rank up
    for (let i = rankThresholds.length - 1; i >= 0; i--) {
        if (currentXP >= rankThresholds[i]) {
            const newRankName = ranks[i];
            const member = await guild.members.fetch(userId);
            const hasRank = member.roles.cache.find(r => r.name === newRankName);

            if (!hasRank) {
                for (const rankName of ranks) {
                    const oldRole = guild.roles.cache.find(r => r.name === rankName);
                    if (oldRole && member.roles.cache.has(oldRole.id)) {
                        await member.roles.remove(oldRole);
                    }
                }

                const newRole = guild.roles.cache.find(r => r.name === newRankName);
                if (newRole) {
                    await member.roles.add(newRole);

                    const winsChannel = guild.channels.cache
                        .find(ch => ch.name === 'wins');
                    if (winsChannel) {
                        await winsChannel.send(
                            `🔥 **RANK UP!**\n\n` +
                            `**${member.user.username}** has advanced to **${newRankName}**!\n\n` +
                            `The system acknowledges your growth.\n` +
                            `Keep grinding Hunter. ⚔️`
                        );
                    }
                }
            }
            break;
        }
    }
});

// ============================================
// AUTO MODERATION
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const member = await message.guild.members.fetch(message.author.id);
    const isMod = member.roles.cache.find(r =>
        r.name === 'Shadow Soldier' || r.name === 'Monarch'
    );
    if (isMod) return;

    // Delete messages with links from non mods
    const hasLink = message.content.includes('http://') ||
        message.content.includes('https://');

    if (hasLink) {
        await message.delete();
        await message.channel.send(
            `⚠️ **${message.author.username}** links are not allowed here Hunter.`
        );

        const userId = message.author.id;
        if (!userWarnings[userId]) userWarnings[userId] = 0;
        userWarnings[userId]++;

        const modLogs = message.guild.channels.cache
            .find(ch => ch.name === 'mod-logs');
        if (modLogs) {
            await modLogs.send(
                `📋 **MOD LOG**\n` +
                `User: ${message.author.username}\n` +
                `Action: Link deleted\n` +
                `Warnings: ${userWarnings[userId]}\n` +
                `Channel: ${message.channel.name}`
            );
        }

        // Auto timeout after 3 warnings
        if (userWarnings[userId] >= 3) {
            await member.timeout(10 * 60 * 1000, 'Too many warnings');
            await message.channel.send(
                `🚫 **${message.author.username}** has been timed out for 10 minutes.`
            );
        }
    }
});

// ============================================
// COMMANDS
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;
    const guild = message.guild;

    // !rank
    if (content === '!rank') {
        const xp = userXP[userId] || 0;
        const member = await guild.members.fetch(userId);
        const currentRank = ranks.reduce((acc, rank, i) => {
            return xp >= rankThresholds[i] ? rank : acc;
        }, ranks[0]);

        const nextRankIndex = ranks.indexOf(currentRank) + 1;
        const nextRank = ranks[nextRankIndex];
        const xpNeeded = nextRank
            ? rankThresholds[nextRankIndex] - xp
            : 0;

        message.reply(
            `⚔️ **Hunter Status**\n\n` +
            `Hunter: **${message.author.username}**\n` +
            `Current Rank: **${currentRank}**\n` +
            `Total XP: **${xp}**\n` +
            `${nextRank
                ? `XP to ${nextRank}: **${xpNeeded} XP**`
                : `You have reached the highest rank. Legendary. 👑`
            }`
        );
    }

    // !quest
    if (content.startsWith('!quest ')) {
        const quest = message.content.slice(7);
        if (!userXP[userId]) userXP[userId] = 0;
        userXP[userId] += 50;
        message.reply(
            `✅ **Quest Logged**\n\n` +
            `Quest: **${quest}**\n` +
            `+50 XP earned.\n` +
            `Total XP: **${userXP[userId]}**\n\n` +
            `The system sees your dedication. Keep going. 🔥`
        );
    }

    // !checkin
    if (content === '!checkin') {
        if (!userXP[userId]) userXP[userId] = 0;
        userXP[userId] += 100;
        message.reply(
            `🔥 **Daily Check In Complete**\n\n` +
            `+100 XP earned.\n` +
            `Total XP: **${userXP[userId]}**\n\n` +
            `Another day of grinding. The system is proud. ⚔️`
        );
    }

    // !streak
    if (content.startsWith('!streak ')) {
        const days = message.content.slice(8);
        userStreaks[userId] = days;
        message.reply(
            `🔥 **Streak Logged**\n\n` +
            `**${message.author.username}** is on a **${days} day streak!**\n` +
            `Don't break the chain. ⚔️`
        );
    }

    // !leaderboard
    if (content === '!leaderboard') {
        const sorted = Object.entries(userXP)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        let board = `👑 **TOP HUNTERS LEADERBOARD**\n\n`;
        for (let i = 0; i < sorted.length; i++) {
            try {
                const user = await client.users.fetch(sorted[i][0]);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                board += `${medal} **${user.username}** — ${sorted[i][1]} XP\n`;
            } catch {
                continue;
            }
        }
        message.channel.send(board);
    }

    // !profile
    if (content === '!profile') {
        const xp = userXP[userId] || 0;
        const streak = userStreaks[userId] || 0;
        const currentRank = ranks.reduce((acc, rank, i) => {
            return xp >= rankThresholds[i] ? rank : acc;
        }, ranks[0]);

        message.reply(
            `👤 **Hunter Profile**\n\n` +
            `Hunter: **${message.author.username}**\n` +
            `Rank: **${currentRank}**\n` +
            `Total XP: **${xp}**\n` +
            `Current Streak: **${streak} days**\n\n` +
            `Keep leveling up. 🔥`
        );
    }

    // !announce (only Monarch can use)
    if (content.startsWith('!announce ')) {
        const member = await guild.members.fetch(userId);
        const isMonarch = member.roles.cache.find(r => r.name === 'Monarch');
        if (!isMonarch) return;

        const announcement = message.content.slice(10);
        const announceChannel = guild.channels.cache
            .find(ch => ch.name === 'announcements');
        if (announceChannel) {
            await announceChannel.send(
                `📢 **ANNOUNCEMENT**\n\n` +
                `${announcement}\n\n` +
                `— The Monarch ⚡`
            );
            message.reply('Announcement posted.');
        }
    }

    // !help
    if (content === '!help') {
        message.reply(
            `⚔️ **SYSTEM COMMANDS**\n\n` +
            `**!rank** — Check your rank and XP\n` +
            `**!profile** — View your full hunter profile\n` +
            `**!quest [task]** — Log a completed quest (+50 XP)\n` +
            `**!checkin** — Daily check in (+100 XP)\n` +
            `**!streak [days]** — Log your current streak\n` +
            `**!leaderboard** — See top 10 hunters\n` +
            `**!help** — Show this menu\n\n` +
            `Stay consistent Hunter. The system rewards the dedicated. 🔥`
        );
    }
});

// ============================================
// SCHEDULED POSTS
// ============================================
function startScheduledPosts() {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const send = (channelName, message) => {
        const channel = guild.channels.cache
            .find(ch => ch.name === channelName);
        if (channel) channel.send(message);
    };

    // Daily 7AM — daily quests
    cron.schedule('0 7 * * *', () => {
        send('daily-quests',
            `⚔️ **Good morning Hunters.**\n\n` +
            `The system has reset. Your daily quests are waiting.\n` +
            `What are you conquering today?\n\n` +
            `Drop your quest list below. Type **!quest [your task]** to log it.\n\n` +
            `**Arise.** 🔥`
        );
    });

    // Daily 8AM — general chat
    cron.schedule('0 8 * * *', () => {
        send('general-chat',
            `Another day. Another chance to level up.\n\n` +
            `What is one thing you are committing to today? 💜`
        );
    });

    // Daily 2PM — accountability
    cron.schedule('0 14 * * *', () => {
        send('accountability',
            `⏰ **Midday check in.**\n\n` +
            `How are your quests going?\n` +
            `Still on track or do you need to push harder?\n\n` +
            `Type **!checkin** if you have been consistent today. 🔥`
        );
    });

    // Daily 7PM — wins
    cron.schedule('0 19 * * *', () => {
        send('wins',
            `🏆 **Evening hunters.**\n\n` +
            `Drop your wins for today.\n` +
            `Big or small. Every XP counts.\n\n` +
            `What did you conquer today? 👑`
        );
    });

    // Sunday 6PM — streak flex
    cron.schedule('0 18 * * 0', () => {
        send('streak-flex',
            `🔥 **Sunday streak check.**\n\n` +
            `How many days have you stayed consistent this week?\n` +
            `Flex your streaks hunters.\n\n` +
            `Type **!streak [number]** to log it. ⚔️`
        );
    });

    // Monday 9AM — weekly kickoff
    cron.schedule('0 9 * * 1', () => {
        send('announcements',
            `⚔️ **New week. New quests. New opportunity.**\n\n` +
            `Set your intentions for this week hunters.\n` +
            `What rank are you chasing?\n` +
            `What habit are you building?\n\n` +
            `The grind starts now. 💜`
        );
    });

    // Wednesday 12PM — midweek check
    cron.schedule('0 12 * * 3', () => {
        send('30-day-challenges',
            `⚡ **Midweek checkpoint.**\n\n` +
            `If you are on a 30 day challenge drop your day count below.\n` +
            `Hold the line. Don't quit now.\n\n` +
            `The system rewards consistency. 🔥`
        );
    });

    // Friday 6PM — end of week push
    cron.schedule('0 18 * * 5', () => {
        send('general-chat',
            `⚔️ **It's Friday hunters.**\n\n` +
            `End the week strong.\n` +
            `Don't break your streak now.\n` +
            `The weekend is where legends are made. 🔥`
        );
    });

    // Sunday 7PM — weekly reflection
    cron.schedule('0 19 * * 0', () => {
        send('transformation',
            `👑 **Weekly reflection.**\n\n` +
            `What changed in you this week?\n` +
            `What did you level up?\n` +
            `Share your progress. Every win matters here. ⚔️`
        );
    });

    // 1st of every month 9AM
    cron.schedule('0 9 1 * *', () => {
        send('announcements',
            `⚔️ **New month. Fresh start.**\n\n` +
            `Set your monthly quests.\n` +
            `What are you leveling up this month?\n\n` +
            `The system is watching. 🔥`
        );
    });

    // Last day of month 8PM
    cron.schedule('0 20 28 * *', () => {
        send('wins',
            `👑 **Month end recap.**\n\n` +
            `Drop your biggest win this month.\n` +
            `We celebrate every hunter's progress here.\n\n` +
            `You showed up. That matters. ⚔️`
        );
    });

    console.log('✅ Scheduled posts running');
}

client.login(process.env.TOKEN);