<h1 align="center">Бот для заключения безопасных сделок.</h1>
Постоянный репозиторий: https://github.com/ScrimCode2/gbot

EN - https://github.com/ScrimCode2/gbot/blob/main/README_En.md

Настройка бота:
в файле .env - тг токен и подключение к БД.
В качестве БД была выбрана PostgreSQL
Как настроить и подключить БД можно найти кучу роликов на YouTube

<p>файл: bot.js - основной файл, отвечающий за всю основную логику бота, также запуск</p>
<p>файл: cryptoBot.mjs - API CryptoPay для оплаты криптом и вывода монет себе напрямую в кошелек</p>
<p>файл: db.js - не трогать</p>
<p>файл: index.js - не трогать</p>
<p>файл: init-db.js - не трогать</p>
<p>файл: models.js - не трогать</p>
<p>файл: cryptoWebhook.js - не трогать</p>

# Что этот бот может:<br>
Этот бот изначально создан для защиты пользователей, где будет возможность безопасно пополнять свой личный кабинет, покупать услуги с гарантией того, что тебя не смогут обмануть.
Вот время активной сделки средства полностью замораживаются и бот не дает вывести их себе в кошелёк.<br>
Для запуска бота, вам заранее нужно установить pgadmin4 и сам postgresql <br>

## Далее по списку<br>
`npm init`<br>
`npm i`<br>
`node init-db.js`<br>
`node bot.js`<br>
в файле req.txt на всякий случай указал весь npm list с нужными версиями<br>
(на версии node-telegram-bot-api@0.66 есть невкусное изменение, но я не помню апдейтнул я его или нет)<br>

в .env подлтягиваете свой токен <br>
в файл: cryptoBot.mjs в константу token - подтягиваете свой токен приложения CryptoPay <br>
апишка заранее за вас реализована, больше вам ничего менять не надо 
<br>
Почему я писал на JS, а не на всемогущем питухоне с его великолепным Aiogram?<br>
Ничего против питухона и Aiogram не имею, было желание написать на JS<br>
<br>
Бота буду апдейтить до webapp<br>
