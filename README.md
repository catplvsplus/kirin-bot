# Kirin

A Minecraft server management tool in Discord. Built using [reciple](https://github.com/reciplejs/reciple) and [@kirinmc/core](https://github.com/catplvsplus/kirin).

## Features

- Start, stop, and restart your Minecraft server from Discord.
- Manage start, stop, and restart permissions.
- View server status of your Minecraft server in Discord.
- View server logs of your Minecraft server in Discord.
- Supports Java and Bedrock server protocols.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) Used as the runtime environment for the application.
- [NPM](https://www.npmjs.com/) (comes with Node.js) Used to install dependencies and run the application.
- [git](https://git-scm.com/downloads) Used to clone the repository.

## Installation

1. Clone the repository:
```
git clone https://github.com/catplvsplus/kirin-bot.git
```

2. Navigate to the project directory:
```
cd kirin-bot
```

3. Install dependencies:
```
npm install
```

4. Create a `.env` file in the root directory of the project and add the following environment variables:
```
DISCORD_TOKEN=your_discord_bot_token
```

5. Build the application:
```
npm run build
```

6. Start the application:
```
npm start
```

## Usage

Once the bot is running, you can use the following commands in your Discord server:

- `/start` Start your Minecraft server.
- `/stop` Stop your Minecraft server.
- `/restart` Restart your Minecraft server.
- `/create` Create a new Minecraft server entry.
- `/delete` Deletes a minecraft server from the list. (Requires global manage permission)
- `/log-channel` Manage a server's log channels.
- `/add-status-message` Add a server status message to a channel.

## Configuration

- The server entries are stored in a JSON file called `servers.json` in the `servers` directory in the root directory of the project.
- The default Discord related configuration is stored in a YAML file called `kirin.global.yml` in the `servers` directory in the root directory of the project.
- The Discord related configuration is stored in a YAML file called `kirin.yml` in the root directory of each server entry.


## License

MIT License