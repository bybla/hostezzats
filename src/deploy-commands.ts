// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Файл для деплоя команд в гильдию


// 
// 
// Если нужно, раскомментируй этот код и используй его для деплоя команд в гильдию
// 
// 
// 
// import { REST, Routes } from "discord.js";
// import { config } from "./config";
// import { commands } from "./commands";

// const commandsData = Object.values(commands).map((command) => command.data);

// const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

// type DeployCommandsProps = {
//   guildId: string;
// };

// export async function deployCommands({ guildId }: DeployCommandsProps) {
//   try {
//     console.log("Started refreshing application (/) commands.");

//     await rest.put(
//       Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
//       {
//         body: commandsData,
//       }
//     );

//     console.log("Successfully reloaded application (/) commands.");
//   } catch (error) {
//     console.error(error);
//   }
// }