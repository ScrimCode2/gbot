A bot for secure transactions. Permanent repository: https://github.com/ScrimCode2/gbot

Bot Setup
In the .env file: specify the Telegram token and the database connection.
Database: PostgreSQL is used as the database. You can find plenty of tutorials on YouTube on how to set up and connect to a PostgreSQL database.
Key Files
bot.js: The main file responsible for the bot's core logic and execution.
cryptoBot.mjs: The CryptoPay API for cryptocurrency payments and direct wallet withdrawals.
db.js: Do not modify.
index.js: Do not modify.
init-db.js: Do not modify.
models.js: Do not modify.
cryptoWebhook.js: Do not modify.
What this bot can do
This bot is designed to protect users by enabling secure transactions. Users can safely top up their accounts and purchase services with the assurance that their funds are safe from fraud. During an active transaction, funds are completely frozen, and the bot ensures they cannot be withdrawn until the transaction is resolved.

How to run the bot
Install pgAdmin4 and PostgreSQL.
Follow these commands:
bash
Копировать код
npm init -y
npm i
node init-db.js
node bot.js
In the req.txt file, I've listed the required npm packages with their versions for reference.
Note: The node-telegram-bot-api@0.66 version has some changes that may cause issues. I don't recall if I updated it or not.
Configuration
In the .env file, add your Telegram token.
In the cryptoBot.mjs file, set your CryptoPay application token in the token constant. The API is already implemented, so no further changes are needed.
Why JavaScript instead of Python and Aiogram?
I have nothing against Python or Aiogram—they're great. However, I simply wanted to write this bot in JavaScript.

Future Plans
I plan to update the bot to include a web app in the future.
