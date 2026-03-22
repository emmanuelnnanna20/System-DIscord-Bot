require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ============================================
// DATA STORAGE
// ============================================
const DATA_FILE = 'data.json';

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    }
    return {};
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let userData = loadData();

function getUser(userId) {
    if (!userData[userId]) {
        userData[userId] = {
            streak: 0,
            missedDays: 0,
            lastActiveDate: null,
            todayMessages: 0,
            rank: 'E Rank Hunter',
            totalActiveDays: 0,
        };
    }
    return userData[userId];
}

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

const rankThresholds = {
    'E Rank Hunter': 0,
    'D Rank Hunter': 7,
    'C Rank Hunter': 21,
    'B Rank Hunter': 60,
    'S Rank Hunter': 100
};

function getRankForStreak(streak) {
    if (streak >= 100) return 'S Rank Hunter';
    if (streak >= 60) return 'B Rank Hunter';
    if (streak >= 21) return 'C Rank Hunter';
    if (streak >= 7) return 'D Rank Hunter';
    return 'E Rank Hunter';
}

function getLowerRank(currentRank) {
    const index = ranks.indexOf(currentRank);
    if (index <= 0) return 'E Rank Hunter';
    return ranks[index - 1];
}

async function assignRank(member, rankName) {
    try {
        // Remove all existing ranks
        for (const rank of ranks) {
            const role = member.guild.roles.cache.find(r => r.name === rank);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        }
        // Assign new rank
        const newRole = member.guild.roles.cache.find(r => r.name === rankName);
        if (newRole) await member.roles.add(newRole);
    } catch (err) {
        console.error('Assign rank error:', err);
    }
}

// ============================================
// BOT READY
// ============================================
client.once('clientReady', async (c) => {
    console.log(`✅ The System is online as ${c.user.tag}`);
    startScheduledPosts();
    startDailyCheck();
    await postChannelDescriptions();
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
                `Introduce yourself here:\n` +
                `• Your name\n` +
                `• Your first quest\n` +
                `• What you are leveling up\n\n` +
                `Show up every day and the system will reward you.\n` +
                `**Arise.** 🔥`
            );
        }

        // Assign E Rank Hunter
        const role = member.guild.roles.cache
            .find(r => r.name === 'E Rank Hunter');
        if (role) await member.roles.add(role);

        // Initialize user data
        getUser(member.id);
        saveData(userData);

    } catch (err) {
        console.error('Welcome error:', err);
    }
});

// ============================================
// TRACK DAILY MESSAGES
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const today = new Date().toISOString().split('T')[0];
    const user = getUser(userId);

    // Count messages for today
    if (user.lastActiveDate === today) {
        user.todayMessages += 1;
    } else {
        user.todayMessages = 1;
    }

    saveData(userData);
});

// ============================================
// DAILY CHECK — runs at midnight every day
// ============================================
function startDailyCheck() {
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily streak check...');

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        for (const userId in userData) {
            const user = userData[userId];

            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                const wasActiveYesterday = user.lastActiveDate === yesterdayStr
                    && user.todayMessages >= 3;

                if (wasActiveYesterday) {
                    // Active — update streak
                    user.streak += 1;
                    user.missedDays = 0;
                    user.totalActiveDays += 1;

                    const newRank = getRankForStreak(user.streak);

                    // Check for rank up
                    if (newRank !== user.rank) {
                        const oldRank = user.rank;
                        user.rank = newRank;
                        await assignRank(member, newRank);

                        const winsChannel = guild.channels.cache
                            .find(ch => ch.name === 'wins');
                        if (winsChannel) {
                            await winsChannel.send(
                                `🔥 **RANK UP!**\n\n` +
                                `**${member.user.username}** has advanced from **${oldRank}** to **${newRank}**!\n\n` +
                                `**${user.streak} days of pure consistency.**\n` +
                                `The system acknowledges your discipline.\n` +
                                `Keep grinding Hunter. ⚔️`
                            );
                        }
                    }

                } else {
                    // Not active yesterday
                    user.missedDays += 1;

                    if (user.missedDays >= 2) {
                        // 2 missed days in a row — drop one rank and reset streak
                        const previousRank = user.rank;
                        const lowerRank = getLowerRank(user.rank);

                        user.streak = 0;
                        user.missedDays = 0;
                        user.rank = lowerRank;

                        await assignRank(member, lowerRank);

                        const generalChannel = guild.channels.cache
                            .find(ch => ch.name === 'general-chat');
                        if (generalChannel && previousRank !== lowerRank) {
                            await generalChannel.send(
                                `⚠️ **${member.user.username}** went absent for 2 days.\n` +
                                `Rank dropped from **${previousRank}** to **${lowerRank}**.\n` +
                                `Streak reset to zero.\n\n` +
                                `Come back stronger Hunter. The grind waits for no one. ⚔️`
                            );
                        }
                    }
                }

                // Reset today's message count for new day
                user.todayMessages = 0;
                saveData(userData);

            } catch (err) {
                console.error(`Error processing user ${userId}:`, err);
            }
        }

        console.log('Daily streak check complete.');
    });
}

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

        const user = getUser(message.author.id);
        if (!user.warnings) user.warnings = 0;
        user.warnings += 1;
        saveData(userData);

        const modLogs = message.guild.channels.cache
            .find(ch => ch.name === 'mod-logs');
        if (modLogs) {
            await modLogs.send(
                `📋 **MOD LOG**\n` +
                `User: ${message.author.username}\n` +
                `Action: Link deleted\n` +
                `Warnings: ${user.warnings}\n` +
                `Channel: ${message.channel.name}`
            );
        }

        if (user.warnings >= 3) {
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
    const user = getUser(userId);

    // !rank
    if (content === '!rank') {
        const nextRankIndex = ranks.indexOf(user.rank) + 1;
        const nextRank = ranks[nextRankIndex];
        const daysNeeded = nextRank
            ? rankThresholds[nextRank] - user.streak
            : 0;

        message.reply(
            `⚔️ **Hunter Status**\n\n` +
            `Hunter: **${message.author.username}**\n` +
            `Current Rank: **${user.rank}**\n` +
            `Current Streak: **${user.streak} days**\n` +
            `Total Active Days: **${user.totalActiveDays} days**\n` +
            `${nextRank
                ? `Days to **${nextRank}**: **${daysNeeded} days**`
                : `You have reached the highest rank. Legendary. 👑`
            }`
        );
    }

    // !streak
    if (content === '!streak') {
        message.reply(
            `🔥 **${message.author.username}** is on a **${user.streak} day streak!**\n` +
            `Total active days: **${user.totalActiveDays}**\n` +
            `Don't break the chain. ⚔️`
        );
    }

    // !profile
    if (content === '!profile') {
        message.reply(
            `👤 **Hunter Profile**\n\n` +
            `Hunter: **${message.author.username}**\n` +
            `Rank: **${user.rank}**\n` +
            `Current Streak: **${user.streak} days**\n` +
            `Total Active Days: **${user.totalActiveDays} days**\n` +
            `Messages Today: **${user.todayMessages}**\n\n` +
            `Keep showing up. The system rewards consistency. 🔥`
        );
    }

    // !leaderboard
    if (content === '!leaderboard') {
        const sorted = Object.entries(userData)
            .sort((a, b) => b[1].streak - a[1].streak)
            .slice(0, 10);

        let board = `👑 **TOP HUNTERS — LONGEST STREAKS**\n\n`;
        for (let i = 0; i < sorted.length; i++) {
            try {
                const u = await client.users.fetch(sorted[i][0]);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                board += `${medal} **${u.username}** — ${sorted[i][1].streak} day streak | ${sorted[i][1].rank}\n`;
            } catch {
                continue;
            }
        }
        message.channel.send(board);
    }

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

    // !help
    if (content === '!help') {
        message.reply(
            `⚔️ **SYSTEM COMMANDS**\n\n` +
            `**!rank** — Check your rank and streak\n` +
            `**!streak** — Check your current streak\n` +
            `**!profile** — View your full hunter profile\n` +
            `**!leaderboard** — See top 10 hunters by streak\n` +
            `**!help** — Show this menu\n\n` +
            `**HOW RANKS WORK:**\n` +
            `Show up and send at least 3 messages every day.\n` +
            `7 days → D Rank Hunter\n` +
            `21 days → C Rank Hunter\n` +
            `60 days → B Rank Hunter\n` +
            `100 days → S Rank Hunter\n\n` +
            `Miss 2 days in a row and your streak resets.\n` +
            `Rank drops one level down.\n\n` +
            `Consistency is everything. **Arise.** 🔥`
        );
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

    // Daily 7AM
    cron.schedule('0 7 * * *', () => {
        send('daily-quests',
            `⚔️ **Good morning Hunters.**\n\n` +
            `The system has reset. Your daily quests are waiting.\n` +
            `What are you conquering today?\n\n` +
            `Drop your quest list below.\n` +
            `Minimum 3 messages today keeps your streak alive.\n\n` +
            `**Arise.** 🔥`
        );
    });

    // Daily 8AM
    cron.schedule('0 8 * * *', () => {
        send('general-chat',
            `Another day. Another chance to level up.\n\n` +
            `What is one thing you are committing to today? 💜`
        );
    });

    // Daily 2PM
    cron.schedule('0 14 * * *', () => {
        send('accountability',
            `⏰ **Midday check in.**\n\n` +
            `How are your quests going?\n` +
            `Still on track or do you need to push harder?\n\n` +
            `Remember — 3 messages a day keeps your streak alive. 🔥`
        );
    });

    // Daily 7PM
    cron.schedule('0 19 * * *', () => {
        send('wins',
            `🏆 **Evening hunters.**\n\n` +
            `Drop your wins for today.\n` +
            `Big or small. Every day counts.\n\n` +
            `What did you conquer today? 👑`
        );
    });

    // Sunday 6PM
    cron.schedule('0 18 * * 0', () => {
        send('streak-flex',
            `🔥 **Sunday streak check.**\n\n` +
            `How many days have you stayed consistent?\n` +
            `Type **!streak** to show yours.\n\n` +
            `Top hunters type **!leaderboard** ⚔️`
        );
    });

    // Monday 9AM
    cron.schedule('0 9 * * 1', () => {
        send('announcements',
            `⚔️ **New week. New quests. New opportunity.**\n\n` +
            `Set your intentions for this week hunters.\n` +
            `What rank are you chasing?\n` +
            `What habit are you building?\n\n` +
            `The grind starts now. 💜`
        );
    });

    // Wednesday 12PM
    cron.schedule('0 12 * * 3', () => {
        send('30-day-challenges',
            `⚡ **Midweek checkpoint.**\n\n` +
            `If you are on a 30 day challenge drop your day count below.\n` +
            `Hold the line. Don't quit now.\n\n` +
            `The system rewards consistency. 🔥`
        );
    });

    // Friday 6PM
    cron.schedule('0 18 * * 5', () => {
        send('general-chat',
            `⚔️ **It's Friday hunters.**\n\n` +
            `End the week strong.\n` +
            `Don't break your streak now.\n` +
            `The weekend is where legends are made. 🔥`
        );
    });

    // Sunday 7PM
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

    // 28th of every month 8PM
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


// ============================================
// ONE TIME CHANNEL DESCRIPTION POSTS
// ============================================
async function postChannelDescriptions() {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const posts = {
        'announcements':
            `📢 **ANNOUNCEMENTS**\n\n` +
            `This is the official channel for all server updates.\n\n` +
            `You will find here:\n` +
            `• App updates and new features\n` +
            `• Server events and challenges\n` +
            `• Important news from the Monarch\n` +
            `• Monthly quest drops\n\n` +
            `Only the Monarch posts here.\n` +
            `Turn on notifications for this channel so you never miss a thing. 🔔`,

        'rules':
            `📜 **SERVER RULES**\n\n` +
            `Read and respect these. No exceptions.\n\n` +
            `**1.** Respect every hunter in this server\n` +
            `**2.** No spam, no self promotion, no unsolicited links\n` +
            `**3.** Keep content relevant — habits, growth, leveling up\n` +
            `**4.** No negativity or discouraging other members\n` +
            `**5.** English only in main channels\n` +
            `**6.** Have fun and stay consistent\n\n` +
            `Break the rules and the system will handle you. ⚔️`,

        'roadmap':
            `🗺️ **ROADMAP**\n\n` +
            `This is where you see what is coming next for the Level Up app.\n\n` +
            `You will find here:\n` +
            `• Upcoming features in development\n` +
            `• Features that just shipped\n` +
            `• The vision for where this app is going\n\n` +
            `Your feedback shapes this roadmap.\n` +
            `Drop feature requests in **#feature-requests**. 💜`,

        'introductions':
            `👋 **INTRODUCTIONS**\n\n` +
            `Every hunter introduces themselves here when they join.\n\n` +
            `When you post tell us:\n` +
            `• Your name\n` +
            `• What you are currently leveling up in your life\n` +
            `• Your first quest\n` +
            `• What rank you are chasing\n\n` +
            `This is where your journey begins.\n` +
            `Welcome to the server Hunter. **Arise.** 🔥`,

        'general-chat':
            `💬 **GENERAL CHAT**\n\n` +
            `The main hub of the server.\n\n` +
            `Talk about anything here:\n` +
            `• Your daily grind\n` +
            `• Motivation and mindset\n` +
            `• App experiences\n` +
            `• Anything related to leveling up your life\n\n` +
            `Keep it positive. Keep it real. Keep it hunter. ⚔️`,

        'memes':
            `😂 **MEMES**\n\n` +
            `The one place to relax and have fun.\n\n` +
            `Drop your best:\n` +
            `• Solo Leveling memes\n` +
            `• Real life RPG memes\n` +
            `• Productivity and grind culture memes\n` +
            `• Anything that makes a hunter laugh\n\n` +
            `Keep it clean. Keep it funny. 💜`,

        'daily-quests':
            `⚔️ **DAILY QUESTS**\n\n` +
            `This is the most important channel in the server.\n\n` +
            `Every single day come here and:\n` +
            `• Post your quest list for the day\n` +
            `• Share what you are committing to\n` +
            `• Hold yourself publicly accountable\n\n` +
            `**The rule:**\n` +
            `At least 3 messages anywhere in the server per day keeps your streak alive.\n` +
            `Miss 2 days in a row and your streak resets. Rank drops.\n\n` +
            `Show up every day. No excuses. 🔥`,

        'wins':
            `🏆 **WINS**\n\n` +
            `This is where hunters celebrate progress.\n\n` +
            `Drop your wins here:\n` +
            `• Completed quests\n` +
            `• Habits you stuck to\n` +
            `• Goals you smashed\n` +
            `• Rank ups\n` +
            `• Any personal victory no matter how small\n\n` +
            `Every win gets celebrated here.\n` +
            `Big or small. You showed up. That matters. 👑`,

        'streak-flex':
            `🔥 **STREAK FLEX**\n\n` +
            `This is where consistent hunters show off.\n\n` +
            `Come here to:\n` +
            `• Flex your current streak\n` +
            `• Celebrate hitting streak milestones\n` +
            `• Motivate others to stay consistent\n\n` +
            `Type **!streak** to display yours.\n` +
            `Type **!leaderboard** to see the top hunters.\n\n` +
            `Consistency is the only cheat code. ⚔️`,

        'accountability':
            `🤝 **ACCOUNTABILITY**\n\n` +
            `This is where hunters keep each other honest.\n\n` +
            `Use this channel to:\n` +
            `• Find an accountability partner\n` +
            `• Check in on your progress midday\n` +
            `• Call yourself out when you fall short\n` +
            `• Support other hunters who are struggling\n\n` +
            `We rise together here. No judgment. Just growth. 💜`,

        'level-up-moments':
            `⚡ **LEVEL UP MOMENTS**\n\n` +
            `Share your rank up screenshots here.\n\n` +
            `When you rank up in the server or level up in the app:\n` +
            `• Screenshot it\n` +
            `• Drop it here\n` +
            `• Let the community celebrate with you\n\n` +
            `These moments are what the grind is for. 🔥`,

        '30-day-challenges':
            `📅 **30 DAY CHALLENGES**\n\n` +
            `This channel is for hunters running long term challenges.\n\n` +
            `How it works:\n` +
            `• Announce your 30 day challenge here on day 1\n` +
            `• Check in every week with your day count\n` +
            `• Complete the 30 days and drop your final post\n\n` +
            `Current and past challenges live here.\n` +
            `Start yours today. 30 days changes everything. ⚔️`,

        'transformation':
            `🌱 **TRANSFORMATION**\n\n` +
            `This is where real growth gets documented.\n\n` +
            `Share here:\n` +
            `• Weekly reflections\n` +
            `• Monthly progress updates\n` +
            `• Before and after stories\n` +
            `• How the app or this community changed you\n\n` +
            `Your story might be exactly what another hunter needs to see.\n` +
            `Document the journey. 👑`,

        'bug-reports':
            `🐛 **BUG REPORTS**\n\n` +
            `Found something broken in the app? Report it here.\n\n` +
            `When reporting a bug include:\n` +
            `• What you were doing when it happened\n` +
            `• What you expected to happen\n` +
            `• What actually happened\n` +
            `• Your device and Android version\n\n` +
            `Every report helps make the app better.\n` +
            `The Monarch reads every single one. 💜`,

        'feature-requests':
            `💡 **FEATURE REQUESTS**\n\n` +
            `Have an idea that would make Level Up better?\n` +
            `Drop it here.\n\n` +
            `Good feature requests include:\n` +
            `• A clear description of what you want\n` +
            `• Why it would help your experience\n` +
            `• How you imagine it working\n\n` +
            `The most requested features go straight to the roadmap.\n` +
            `Your voice shapes this app. ⚔️`,

        'app-feedback':
            `📱 **APP FEEDBACK**\n\n` +
            `General thoughts on the Level Up app go here.\n\n` +
            `Share:\n` +
            `• What you love about the app\n` +
            `• What you think could be better\n` +
            `• Your overall experience\n` +
            `• Reviews and honest opinions\n\n` +
            `Honest feedback only. No sugarcoating needed.\n` +
            `This is how the app gets legendary. 🔥`,

        'anime-talk':
            `⚔️ **ANIME TALK**\n\n` +
            `The Solo Leveling fan zone.\n\n` +
            `Talk about:\n` +
            `• Solo Leveling manga and anime\n` +
            `• Favourite hunters and arcs\n` +
            `• Other anime and manhwa\n` +
            `• Anything from the Solo Leveling universe\n\n` +
            `Sung Jin-Woo would be proud you are here. 💜`,

        'off-topic':
            `💭 **OFF TOPIC**\n\n` +
            `Everything that does not fit anywhere else goes here.\n\n` +
            `Talk about:\n` +
            `• Life in general\n` +
            `• Random thoughts\n` +
            `• Anything that is not covered in other channels\n\n` +
            `Keep it respectful. Keep it real. 🔥`,
    };

    for (const [channelName, content] of Object.entries(posts)) {
        try {
            const channel = guild.channels.cache
                .find(ch => ch.name === channelName);

            if (!channel) {
                console.log(`Channel not found: ${channelName}`);
                continue;
            }

            // Check if already posted — look for pinned messages
            const pins = await channel.messages.fetchPinned();
            const alreadyPosted = pins.some(msg =>
                msg.author.id === client.user.id
            );

            if (alreadyPosted) {
                console.log(`Already posted in: ${channelName}`);
                continue;
            }

            // Send and pin the message
            const sent = await channel.send(content);
            await sent.pin();
            console.log(`✅ Posted and pinned in: ${channelName}`);

            // Small delay between posts so Discord doesn't rate limit
            await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (err) {
            console.error(`Error posting in ${channelName}:`, err);
        }
    }

    console.log('✅ All channel descriptions posted and pinned.');
}

client.login(process.env.TOKEN);