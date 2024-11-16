<h1 align="center">Secure Transaction Bot</h1>
Permanent repository: [https://github.com/ScrimCode2/gbot](https://github.com/ScrimCode2/gbot)

EN - [https://github.com/ScrimCode2/gbot/blob/main/README_En.md](https://github.com/ScrimCode2/gbot/blob/main/README_En.md)

### Bot Setup
- In the `.env` file: specify your **Telegram token** and database connection.
- Database: PostgreSQL is used. You can find plenty of tutorials on YouTube to learn how to set up and connect to a PostgreSQL database.

<p>File: bot.js - The main file responsible for the bot's core logic and execution.</p>
<p>File: cryptoBot.mjs - CryptoPay API for cryptocurrency payments and direct wallet withdrawals.</p>
<p>File: db.js - Do not modify.</p>
<p>File: index.js - Do not modify.</p>
<p>File: init-db.js - Do not modify.</p>
<p>File: models.js - Do not modify.</p>
<p>File: cryptoWebhook.js - Do not modify.</p>

---

# What this bot can do
This bot was originally designed to protect users. It enables secure account top-ups and service purchases, ensuring that users cannot be scammed.  
During an active transaction, funds are completely frozen, and the bot prevents them from being withdrawn until the transaction is resolved.

### Requirements for Running the Bot
1. Install pgAdmin4 and PostgreSQL.
2. Then follow these commands:<br>
`npm init`<br>
`npm i`<br>
`node init-db.js`<br>
`node bot.js`<br>

The file req.txt includes a list of required npm packages with their versions for reference.<br>
Note: The node-telegram-bot-api@0.66 version has some changes that may cause issues. I don't recall if I updated it.<br>
In the .env file, add your Telegram token.<br>
In the cryptoBot.mjs file, set your CryptoPay application token in the token constant.<br>
The API is already implemented, so no further changes are required.<br>

Why JavaScript instead of Python and Aiogram?<br>
I have nothing against Python or Aiogram—they're amazing. I simply wanted to write this bot in JavaScript.<br>
<br>
Future Updates<br>
The bot will be updated to include a web app in the future.<br>
