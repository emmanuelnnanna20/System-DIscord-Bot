require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
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
// BOT READY
// ============================================
client.once('clientReady', async (c) => {
    console.log(`✅ The System is online as ${c.user.tag}`);
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
                `Welcome **${member.user.username}**!\n\n` +
                `Introduce yourself:\n` +
                `• Your name\n` +
                `• What you are currently working on in your life\n` +
                `• One goal you are chasing right now\n\n` +
                `Glad you are here. Let's level up together.\n` +
                `**Arise.** 🔥`
            );
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
    if (!guild) return;

    const send = (channelName, msg) => {
        const channel = guild.channels.cache
            .find(ch => ch.name === channelName);
        if (channel) channel.send(msg);
    };

    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // ============================================
    // DAILY 7AM — APP QUEST REMINDER
    // ============================================
    const questReminders = [
        `⚔️ **Good morning Hunter.**\n\nYour daily quests are waiting in the app.\nOpen Level Up. Complete your quests. Stay consistent.\n\nThe grind starts now. 🔥`,
        `🌅 **Rise and grind Hunter.**\n\nHave you opened the app today?\nYour quests reset. Your streak is on the line.\nDon't let today be the day you break the chain. ⚔️`,
        `⚡ **Day ${new Date().getDate()}. Quests are live.**\n\nOpen Level Up and get to work.\nEvery completed quest is a step closer to the best version of you.\nArise. 🔥`,
        `🎯 **Your quests are not going to complete themselves.**\n\nOpen the app. Lock in.\nOne quest at a time. That is all it takes.\nLet's go Hunter. ⚔️`,
        `💜 **The system has reset.**\n\nFresh day. Fresh quests. Fresh opportunity.\nOpen Level Up and make today count.\nConsistency builds legends. 🔥`,
        `🔥 **Morning Hunter.**\n\nWhile everyone else is sleeping on their potential you are here.\nOpen the app. Complete your quests. Stay ahead.\nArise. ⚔️`,
        `⚔️ **New day. Same mission.**\n\nGet on the app and complete your daily quests.\nSmall wins every day build massive results over time.\nYou already know what to do. 🔥`,
    ];

    cron.schedule('0 7 * * *', () => {
        send('daily-quests', random(questReminders));
    });

    // ============================================
    // DAILY 8AM — GENERAL MOTIVATION
    // ============================================
    const morningMessages = [
        `What is one thing you are committing to today? Drop it below. 💜`,
        `One habit. One day. One step forward.\nWhat are you working on today? ⚔️`,
        `The version of you that you want to become is built one day at a time.\nWhat does today look like for you? 🔥`,
        `Good morning hunters. What is on your quest list today? Drop it. 💜`,
        `Every day you show up is a day the old version of you loses.\nWhat are you doing today? ⚔️`,
        `Motivation gets you started. Discipline keeps you going.\nWhat are you locking in on today? 🔥`,
        `Another day to be better than yesterday.\nWhat is your focus today hunters? 💜`,
    ];

    cron.schedule('0 8 * * *', () => {
        send('general-chat', random(morningMessages));
    });

    // ============================================
    // DAILY 2PM — MIDDAY CHECK IN
    // ============================================
    const middayMessages = [
        `⏰ **Midday check in.**\n\nHave you opened the app today?\nHow are your quests going? Still on track? 🔥`,
        `⚡ **Halfway through the day.**\n\nIf you have not touched the app yet — now is the time.\nNo quest left behind. ⚔️`,
        `💜 **Afternoon hunters.**\n\nChecking in. How is the grind going?\nDrop your progress below. Let's hear it. 🔥`,
        `🎯 **Midday reminder.**\n\nYour quests are still waiting if you have not done them.\nClose this. Open Level Up. Handle it. ⚔️`,
        `⚔️ **It is not too late.**\n\nWhatever you have not done today — you still have time.\nGet on the app. Finish strong. 🔥`,
    ];

    cron.schedule('0 14 * * *', () => {
        send('accountability', random(middayMessages));
    });

    // ============================================
    // DAILY 7PM — EVENING WINS
    // ============================================
    const eveningMessages = [
        `🏆 **Evening hunters.**\n\nDrop your wins for today.\nBig or small. Did you complete your quests? Let's hear it. 👑`,
        `⚔️ **Day is almost done.**\n\nWhat did you conquer today?\nDrop your wins below. Every victory counts. 🔥`,
        `💜 **Evening check in.**\n\nDid you complete your quests today?\nShare your wins. We celebrate everything here. 👑`,
        `🔥 **End of day hunters.**\n\nWhat did you get done today?\nHold yourself accountable. Drop it below. ⚔️`,
        `👑 **Before you sleep.**\n\nDid you complete your quests?\nDrop your wins. Reflect on today. Show up again tomorrow. 🔥`,
    ];

    cron.schedule('0 19 * * *', () => {
        send('wins', random(eveningMessages));
    });

    // ============================================
    // DAILY 9PM — APP REMINDER BEFORE BED
    // ============================================
    const nightReminders = [
        `🌙 **Before you close your eyes.**\n\nDid you log your quests in the app today?\nOpen Level Up. Complete what is left.\nTomorrow is another chance. Arise. ⚔️`,
        `💜 **Night reminder hunters.**\n\nStreak on the line.\nIf you have not opened Level Up today — do it now.\nDon't break the chain. 🔥`,
        `⚔️ **Last call for today's quests.**\n\nOpen the app. Log your progress.\nEvery day you show up compounds into something legendary. 👑`,
        `🌙 **The day is almost over.**\n\nHave you completed your quests?\nOpen Level Up. Finish strong. Sleep with a win. 🔥`,
    ];

    cron.schedule('0 21 * * *', () => {
        send('daily-quests', random(nightReminders));
    });

    // ============================================
    // MONDAY 9AM — WEEKLY KICKOFF
    // ============================================
    const mondayMessages = [
        `⚔️ **New week. New quests. New opportunity.**\n\nSet your intentions for this week.\nWhat are you building? What habit are you locking in?\nThe grind starts now. 💜`,
        `🔥 **Monday is not the enemy.**\n\nMonday is the reset. The fresh start. The opportunity.\nSet your weekly goals. Open the app. Let's go. ⚔️`,
        `💜 **Week ${Math.ceil(new Date().getDate() / 7)} begins.**\n\nWhat does this week look like for you hunters?\nDrop your weekly intentions below. Hold each other accountable. 🔥`,
        `⚡ **The week just dropped like a dungeon gate.**\n\nAre you ready?\nSet your quests. Lock in your habits. Go. ⚔️`,
    ];

    cron.schedule('0 9 * * 1', () => {
        send('announcements', random(mondayMessages));
    });

    // ============================================
    // WEDNESDAY 12PM — MIDWEEK CHECK
    // ============================================
    const wednesdayMessages = [
        `⚡ **Midweek checkpoint.**\n\nHow is your week going?\nAre you on track with your quests and habits?\nDrop your progress below. 🔥`,
        `💜 **Wednesday hunters.**\n\nHalf the week is gone.\nWhat have you accomplished so far?\nWhat still needs to get done? ⚔️`,
        `⚔️ **Week is not over.**\n\nWhatever fell off this week — you still have time.\nGet back on the app. Finish the week strong. 🔥`,
        `🎯 **Midweek reality check.**\n\nAre you where you said you would be this week?\nIf not — today is the day to fix it. ⚔️`,
    ];

    cron.schedule('0 12 * * 3', () => {
        send('30-day-challenges', random(wednesdayMessages));
    });

    // ============================================
    // FRIDAY 6PM — END OF WEEK PUSH
    // ============================================
    const fridayMessages = [
        `⚔️ **It is Friday hunters.**\n\nEnd the week strong.\nDon't go into the weekend with incomplete quests.\nFinish what you started. 🔥`,
        `🔥 **Friday is not the finish line.**\n\nThe weekend is two more days to stay consistent.\nDon't let the week end without your wins. ⚔️`,
        `💜 **Almost at the end of the week.**\n\nHow did you do?\nDrop your weekly wins below before the weekend hits. 👑`,
        `⚡ **Friday push.**\n\nOpen the app. Complete today's quests.\nGo into the weekend with momentum. ⚔️`,
    ];

    cron.schedule('0 18 * * 5', () => {
        send('general-chat', random(fridayMessages));
    });

    // ============================================
    // SUNDAY 6PM — STREAK CHECK
    // ============================================
    const sundayStreakMessages = [
        `🔥 **Sunday streak check.**\n\nHow many days have you stayed consistent this week?\nDrop your streak below. We see you. ⚔️`,
        `💜 **End of the week hunters.**\n\nHow consistent were you this week with the app?\nShare your streak. Celebrate your discipline. 🔥`,
        `⚔️ **Sunday accountability.**\n\nDid you show up every day this week?\nDrop your honest answer below. Growth starts with truth. 💜`,
    ];

    cron.schedule('0 18 * * 0', () => {
        send('streak-flex', random(sundayStreakMessages));
    });

    // ============================================
    // SUNDAY 7PM — WEEKLY REFLECTION
    // ============================================
    const sundayReflectionMessages = [
        `👑 **Weekly reflection.**\n\nWhat changed in you this week?\nWhat did you level up?\nShare your progress. Every win matters here. ⚔️`,
        `💜 **Before the new week begins.**\n\nReflect on this week.\nWhat worked? What did not? What will you do differently?\nDrop it below. 🔥`,
        `🌱 **Sunday reflection hunters.**\n\nGrowth is not always visible immediately.\nBut every day you showed up compounded into something real.\nWhat are you taking into next week? ⚔️`,
        `⚔️ **Week in review.**\n\nBe honest with yourself.\nWhere did you show up? Where did you fall short?\nThis reflection is how you get better. 💜`,
    ];

    cron.schedule('0 19 * * 0', () => {
        send('transformation', random(sundayReflectionMessages));
    });

    // ============================================
    // 1ST OF EVERY MONTH — NEW MONTH
    // ============================================
    const newMonthMessages = [
        `⚔️ **New month. Fresh start.**\n\nSet your monthly quests in the app.\nWhat are you leveling up this month?\nThe system is watching. 🔥`,
        `🔥 **Month one begins today.**\n\nNew month means new goals. New habits. New opportunities.\nOpen Level Up. Set your quests. Go. ⚔️`,
        `💜 **First day of the month hunters.**\n\nThis month you will be consistent.\nThis month you will show up.\nThis month you level up. Start today. 🔥`,
    ];

    cron.schedule('0 9 1 * *', () => {
        send('announcements', random(newMonthMessages));
    });

    // ============================================
    // 28TH OF EVERY MONTH — MONTH END RECAP
    // ============================================
    const monthEndMessages = [
        `👑 **Month end recap.**\n\nDrop your biggest win this month.\nWe celebrate every hunter's progress here.\nYou showed up. That matters. ⚔️`,
        `🔥 **Month is almost over.**\n\nHow did you do?\nDrop your monthly wins below.\nEvery step forward is worth celebrating. 💜`,
        `⚔️ **Final days of the month.**\n\nReflect on how far you have come.\nDrop your progress below.\nNext month we go harder. 🔥`,
    ];

    cron.schedule('0 20 28 * *', () => {
        send('wins', random(monthEndMessages));
    });

    console.log('✅ Scheduled posts running');
}

client.login(process.env.TOKEN);
