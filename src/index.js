const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const { TOKEN } = require("./config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const PREFIX = "!";

const userActivity = new Map();
const userVoiceChannel = new Map();

client.on("ready", () => {
  console.log(
    `Zalogowano bota! ${client.user.tag} ${client.user.discriminator}`
  );

  // Uruchom funkcję sprawdzającą co 1 sekundę
  setInterval(() => {
    checkVoiceChannels();
  }, 1000); // 1000 milisekund = 1 sekunda
});

client.on("voiceStateUpdate", (_, newState) => {
  const userId = newState.member.id;
  const currentTime = userActivity.get(userId) || 0;
  const lastVoiceChannel = userVoiceChannel.get(userId);

  if (newState.channelId !== lastVoiceChannel) {
    // Użytkownik zmienił kanał głosowy
    userActivity.set(userId, currentTime);
    userVoiceChannel.set(userId, newState.channelId);
  } else if (newState.channelId && !userActivity.has(userId)) {
    // Użytkownik nadal jest w tym samym kanale głosowym i nie był aktualizowany wcześniej
    userActivity.set(userId, currentTime + 1);
  } else if (!newState.channelId) {
    // Użytkownik opuścił kanał głosowy
    userActivity.delete(userId);
    userVoiceChannel.delete(userId);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const commandName = args.shift().toLowerCase();
  if (commandName === "lista") {
    const authorId = message.author.id;
    const authorActivity = userActivity.get(authorId) || 0;

    const topUsers = Array.from(userActivity.entries())
      .filter(([userId, time]) => time > 0 && userId !== "Nieznany użytkownik")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    const topUsersMessage = await Promise.all(
      topUsers.map(([userId, time], index) => {
        const member = message.guild.members.cache.get(userId);
        const username = member ? member.displayName : "Nieznany użytkownik";
        return `**${index + 1}**. ${username}: **${formatTime(time)}**`;
      })
    );

    const authorMember = await message.guild.members.fetch(authorId).catch(console.error);
    const authorUsername = authorMember ? authorMember.displayName : "Nieznany użytkownik";
    const authorIndex = topUsers.findIndex(([userId]) => userId === authorId);
    const authorMessage = authorIndex !== -1 ? `Twoje miejsce: **${authorIndex + 1}**. ${authorUsername}: **${formatTime(authorActivity)}**` : "Nie znaleziono Twojego miejsca w rankingu";
    
    if (authorIndex !== -1) {
      topUsersMessage.unshift(authorMessage);
    } else {
      // Dodaj autora na końcu listy, jeśli nie jest już wśród topUsers
      topUsersMessage.push(authorMessage);
    }

    const embedMessage = {
    
      embeds: [
        {
          color: 0xFF0000, // Kolor szary (możesz dostosować)
          title: "TOP 50 Najaktywniejszych Użytkowników",
          description: topUsersMessage.join("\n"),
        },
      ],
    };

    message.channel.send(embedMessage);
  }else if (commandName === "reset") {
    // Komenda resetująca czas
    resetActivity();
    message.channel.send("Czas został zresetowany. Lista zaczyna się od nowa.");
    return;
  }
});

function resetActivity() {
  userActivity.clear();
  userVoiceChannel.clear();
}
client.on("voiceStateUpdate", (_, newState) => {
  const userId = newState.member.id;
  const currentTime = userActivity.get(userId) || 0;
  const lastVoiceChannel = userVoiceChannel.get(userId);

  if (newState.channelId !== lastVoiceChannel) {
    // Użytkownik zmienił kanał głosowy
    userActivity.set(userId, currentTime);
    userVoiceChannel.set(userId, newState.channelId);
  } else if (newState.channelId && !userActivity.has(userId)) {
    // Użytkownik nadal jest w tym samym kanale głosowym i nie był aktualizowany wcześniej
    userActivity.set(userId, currentTime + 1);
  }
});

function checkVoiceChannels() {
  // Sprawdź wszystkich użytkowników na serwerze
  client.guilds.cache.forEach((guild) => {
    guild.members.cache.forEach((member) => {
      if (member.voice?.channel) {
        const userId = member.id;
        const currentTime = userActivity.get(userId) || 0;

        // Sprawdź, czy czas nie został już dodany w ostatniej sekundzie
        if (member.voice.selfDeaf || member.voice.selfMute) {
          // Pomijaj aktualizację czasu, jeśli użytkownik jest zagłuszony lub wyciszony
          return;
        }

        const lastVoiceChannel = userVoiceChannel.get(userId);

        if (member.voice.channelId !== lastVoiceChannel) {
          // Użytkownik zmienił kanał głosowy, zresetuj licznik
          userActivity.set(userId, 1);
          userVoiceChannel.set(userId, member.voice.channelId);
        } else {
          // Użytkownik nadal jest na kanale głosowym, zaktualizuj czas
          userActivity.set(userId, currentTime + 1);
        }
      }
    }
    
    );
  });
}

client.login(TOKEN);

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}
