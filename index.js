require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const dailyQuotes = require('./quotes');
const {
    welcomeMessages,
    questReminders,
    accountabilityMessages,
    morningMessages,
    eveningMessages,
    nightReminders,
} = require('./messages');
const {
    mondayMessages,
    wednesdayMessages,
    fridayMessages,
    sundayStreakMessages,
    sundayReflectionMessages,
    newMonthMessages,
    monthEndMessages,
} = require('./weeklyMessages');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ============================================
// UTILITY — SMART RANDOM (no repeats)
// ============================================
const recentPicks = {};

function smartRandom(arr, key) {
    if (!recentPicks[key]) recentPicks[key] = [];

    // Filter out recently used messages
    const available = arr.filter((_, i) => !recentPicks[key].includes(i));

    // If all messages have been used, reset the history
    const pool = available.length > 0 ? available : arr;
    if (available.length === 0) recentPicks[key] = [];

    const index = Math.floor(Math.random() * pool.length);
    const picked = pool[index];

    // Track the original index to avoid repeats
    const originalIndex = arr.indexOf(picked);
    recentPicks[key].push(originalIndex);

    // Keep history to half the array size to ensure variety
    const maxHistory = Math.floor(arr.length / 2);
    if (recentPicks[key].length > maxHistory) {
        recentPicks[key] = recentPicks[key].slice(-maxHistory);
    }

    return picked;
}

// ============================================
// UTILITY — GET DAILY QUOTE (sequential, one per day)
// ============================================
function getDailyQuote() {
    const startDate = new Date('2026-01-01');
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const quoteIndex = diffDays % dailyQuotes.length;
    return dailyQuotes[quoteIndex];
}

// ============================================
// BOT READY
// ============================================
client.once('clientReady', async (c) => {
    console.log(`✅ The System is online as ${c.user.tag}`);
    startScheduledPosts();
});

// ============================================
// WELCOME NEW MEMBERS (with variation)
// ============================================
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeChannel = member.guild.channels.cache
            .find(ch => ch.name === 'introductions');

        if (welcomeChannel) {
            const welcomeFn = smartRandom(welcomeMessages, 'welcome');
            const message = welcomeFn(member.user.username);
            await welcomeChannel.send(message);
        }

    } catch (err) {
        console.error('Welcome error:', err);
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

    const hasLink = message.content.includes('http://') ||
        message.content.includes('https://');

    if (hasLink) {
        await message.delete();
        await message.channel.send(
            `⚠️ **${message.author.username}** links are not allowed here Hunter.`
        );

        const modLogs = message.guild.channels.cache
            .find(ch => ch.name === 'mod-logs');
        if (modLogs) {
            await modLogs.send(
                `📋 **MOD LOG**\n` +
                `User: ${message.author.username}\n` +
                `Action: Link deleted\n` +
                `Channel: ${message.channel.name}`
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

    // !announce — Monarch only
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
});

// ============================================
// SCHEDULED POSTS
// ============================================
function startScheduledPosts() {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        console.error('❌ Could not find guild. Check GUILD_ID.');
        return;
    }

    const send = (channelName, msg) => {
        const channel = guild.channels.cache
            .find(ch => ch.name === channelName);
        if (channel) {
            channel.send(msg);
        } else {
            console.warn(`⚠️ Channel "${channelName}" not found`);
        }
    };

    // ── DAILY 7AM — QUEST REMINDER ──
    cron.schedule('0 7 * * *', () => {
        send('daily-quests', smartRandom(questReminders, 'quest'));
    });

    // ── DAILY 8AM — DAILY QUOTE + MORNING MESSAGE ──
    cron.schedule('0 8 * * *', () => {
        const quote = getDailyQuote();
        const quoteMsg = `🗡️ **Quote of the Day**\n\n> *${quote}*\n\n⚔️ Arise, hunter.`;
        send('general-chat', quoteMsg);
    });

    // ── DAILY 9AM — MORNING MOTIVATION ──
    cron.schedule('0 9 * * *', () => {
        send('general-chat', smartRandom(morningMessages, 'morning'));
    });

    // ── DAILY 2PM — ACCOUNTABILITY ──
    cron.schedule('0 14 * * *', () => {
        send('accountability', smartRandom(accountabilityMessages, 'accountability'));
    });

    // ── DAILY 7PM — EVENING ──
    cron.schedule('0 19 * * *', () => {
        send('wins', smartRandom(eveningMessages, 'evening'));
    });

    // ── DAILY 9PM — NIGHT REMINDER ──
    cron.schedule('0 21 * * *', () => {
        send('daily-quests', smartRandom(nightReminders, 'night'));
    });

    // ── MONDAY 9AM — WEEKLY KICKOFF ──
    cron.schedule('30 9 * * 1', () => {
        send('announcements', smartRandom(mondayMessages, 'monday'));
    });

    // ── WEDNESDAY 12PM — MIDWEEK CHECK ──
    cron.schedule('0 12 * * 3', () => {
        send('30-day-challenges', smartRandom(wednesdayMessages, 'wednesday'));
    });

    // ── FRIDAY 6PM — END OF WEEK ──
    cron.schedule('0 18 * * 5', () => {
        send('general-chat', smartRandom(fridayMessages, 'friday'));
    });

    // ── SUNDAY 6PM — STREAK CHECK ──
    cron.schedule('0 18 * * 0', () => {
        send('streak-flex', smartRandom(sundayStreakMessages, 'streak'));
    });

    // ── SUNDAY 7PM — WEEKLY REFLECTION ──
    cron.schedule('0 19 * * 0', () => {
        send('transformation', smartRandom(sundayReflectionMessages, 'reflection'));
    });

    // ── 1ST OF MONTH — NEW MONTH ──
    cron.schedule('0 9 1 * *', () => {
        send('announcements', smartRandom(newMonthMessages, 'newmonth'));
    });

    // ── 28TH OF MONTH — MONTH END RECAP ──
    cron.schedule('0 20 28 * *', () => {
        send('wins', smartRandom(monthEndMessages, 'monthend'));
    });

    console.log('✅ Scheduled posts running');
}

client.login(process.env.TOKEN);
