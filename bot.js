const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const cryptoWebhook = require('./cryptoWebhook');
const { telegramToken } = require('./config');
const { User, Deal, Review, Transaction, DealAgreement } = require('./models');
const { addUser } = require('./addUser');
const { sequelize, Sequelize } = require('./db');

const bot = new TelegramBot('6726152643:AAEfFD8YwmjIk3A8PPgwvcbGy_sYGV2LbRU', { polling: true });
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use('/', cryptoWebhook);

let createInvoice, checkInvoiceStatus, transfer;
(async () => {
    const cryptoModule = await import('./cryptoBot.mjs');
    createInvoice = cryptoModule.createInvoice;
    checkInvoiceStatus = cryptoModule.checkInvoiceStatus;
    transfer = cryptoModule.transfer;
})();


const userStates = {};
const dealsPerPage = 5; 
const userLinks = {};
const activeProcesses = {}; 



async function sendMessage(chatId, text, options = {}) {
    try {
        const message = await bot.sendMessage(chatId, text, options);
        return message;
    } catch (error) {
        console.error(`Ошибка при отправке сообщения: ${error.message}`);
    }
}

function normalizeUsername(username) {
    return username.startsWith('@') ? username.substring(1) : username;
}

function sendMessage(chatId, text, options = {}) {
    return bot.sendMessage(chatId, text, options).catch((error) => {
        console.error(`Ошибка при отправке сообщения: ${error.message}`);
    });
}

async function checkUser(chatId) {
    return await User.findOne({ where: { chatId: chatId.toString() } });
}

async function checkAndUpdateLink(chatId, newLink) {
    const currentLink = userLinks[chatId];
    if (currentLink !== newLink) {
        userLinks[chatId] = newLink;
        console.log(`Ссылка пользователя ${chatId} обновлена на ${newLink}`);
    } else {
        console.log(`Ссылка пользователя ${chatId} не изменилась`);
    }
}

async function hasOpenDeals(userId) {
    const openDeals = await Deal.findAll({
        where: {
            [Sequelize.Op.or]: [
                { buyerId: userId, status: ['in progress', 'spore', 'opened'] },
                { sellerId: userId, status: ['in progress', 'spore', 'opened'] }
            ]
        }
    });
    return openDeals.length > 0;
}

async function showDealsPage(chatId, page = 0) {
    if (activeProcesses[chatId]) {
        console.log(`Запрос сделки для пользователя ${chatId} уже выполняется`);
        return;
    }

    activeProcesses[chatId] = true;

    try {
        const deals = await Deal.findAll({
            where: {
                [Sequelize.Op.or]: [{ buyerId: chatId.toString() }, { sellerId: chatId.toString() }]
            }
        });

        if (deals.length === 0) {
            await sendMessage(chatId, "У вас нет сделок.");
            return;
        }

        const start = page * dealsPerPage;
        const end = start + dealsPerPage;
        const pageDeals = deals.slice(start, end);

        const dealMessages = pageDeals
            .map(deal => `#️⃣${deal.id}: Сумма: ${deal.amount}, Статус: ${deal.status}\nдля детального просмотра нажмите /deal_${deal.id}\n------------------------------------------------`)
            .join('\n');

        const inlineKeyboard = [];
        if (page > 0) {
            inlineKeyboard.push({ text: '⬅️ Назад', callback_data: `deals_page_${page - 1}` });
        }
        if (end < deals.length) {
            inlineKeyboard.push({ text: '➡️ Далее', callback_data: `deals_page_${page + 1}` });
        }

        const options = {
            reply_markup: {
                inline_keyboard: [inlineKeyboard]
            }
        };

        if (userStates[chatId] && userStates[chatId].messageId) {
            const currentState = userStates[chatId];
            const isTextSame = currentState.dealMessages === dealMessages;
            const isMarkupSame = JSON.stringify(currentState.inlineKeyboard) === JSON.stringify(inlineKeyboard);

            if (!isTextSame || !isMarkupSame) {
                console.log(`Редактирование сообщения для пользователя ${chatId}`);
                await bot.editMessageText(dealMessages, {
                    chat_id: chatId,
                    message_id: currentState.messageId,
                    reply_markup: options.reply_markup
                });
                userStates[chatId] = { messageId: currentState.messageId, page, dealMessages, inlineKeyboard };
            } else {
                console.log(`Сообщение для пользователя ${chatId} не изменилось, редактирование не требуется`);
            }
        } else {
            console.log(`Отправка нового сообщения для пользователя ${chatId}`);
            const message = await sendMessage(chatId, dealMessages, options);
            userStates[chatId] = { messageId: message.message_id, page, dealMessages, inlineKeyboard };
        }
    } catch (error) {
        console.error(`Ошибка при получении и отображении сделок: ${error.message}`);
    } finally {
        activeProcesses[chatId] = false;
    }
}

bot.onText(/💸Сделки/, async (msg) => {
    const chatId = msg.chat.id;
    showDealsPage(chatId, 0);
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('deals_page_')) {
        const page = parseInt(data.split('_')[2], 10);
        showDealsPage(chatId, page);
    }

    bot.answerCallbackQuery(query.id);
});


bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = normalizeUsername(msg.from.username || 'анонимный пользователь');
    const userId = msg.from.id;
    const userExists = await checkUser(chatId);

    const options = {
        reply_markup: {
            keyboard: [
                [{ text: '🔍Найти пользователя' }, { text: '💸Сделки' }, { text: '💎Отзывы' }],
                [{ text: '🧾Условия пользования ботом' }, { text: '🪬Профиль' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };

    if (userExists) {
        const currentLink = userLinks[chatId] || userExists.username;
        if (currentLink !== username) {
            userLinks[chatId] = username;
            await User.update({ username }, { where: { chatId: chatId.toString() } });
            console.log(`Ссылка пользователя ${chatId} обновлена на ${username}`);
        }
        sendMessage(chatId, `Вы уже зарегистрированы! Ваша текущая ссылка: ${username}`, options);
    } else {
        const userData = { id: chatId.toString(), username, balance: 0.00, chatId: userId.toString() };
        const user = await addUser(userData);
        const registrationMessage = user ? "Вы успешно зарегистрированы!" : "Не удалось зарегистрировать пользователя. Попробуйте еще раз.";
        sendMessage(chatId, registrationMessage, options);
        userLinks[chatId] = username;
    }
});

bot.onText(/\/open_webapp/, (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = 'http://localhost:3001/webapp';

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Открыть WebApp',
                        web_app: { url: webAppUrl }
                    }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы открыть WebApp:', options);
});


bot.on('message', async (msg) => {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();
    const username = msg.from?.username ? normalizeUsername(msg.from.username) : 'анонимный пользователь';

    if (!chatId || !text) return;

    const userExists = await checkUser(chatId);
    if (userExists) {
        const currentLink = userLinks[chatId] || userExists.username;
        if (currentLink !== username) {
            userLinks[chatId] = username;
            await User.update({ username }, { where: { chatId: chatId.toString() } });
            console.log(`Ссылка пользователя ${chatId} обновлена на ${username}`);
        }
    }

    const commands = {
        '🔍Найти пользователя': () => sendMessage(chatId, "Введите имя пользователя, которого хотите найти с @"),
        '💸Сделки': async () => {
            const message = await sendMessage(chatId, "Загрузка сделок...");
            userStates[chatId] = { messageId: message.message_id, page: 0 };
            showDealsPage(chatId, 0);
        },
        '💎Отзывы': async () => {
            const reviews = await Review.findAll({ where: { userId: chatId.toString() } });
            const reviewMessages = reviews.map(review => `${review.content} - ${review.rating}`).join('\n');
            sendMessage(chatId, reviewMessages || "У вас нет отзывов.");
        },
        '🧾Условия пользования ботом': () => sendMessage(chatId, "Ссылка на условия использования."),
        '🪬Профиль': async () => {
            const user = await checkUser(chatId);
            if (user) {
                const reviews = await Review.findAll({ where: { userId: user.id } });
                let averageRating = 0;
                let successfulDeals = 0;
                let unsuccessfulDeals = 0;

                if (reviews.length > 0) {
                    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
                    averageRating = (totalRating / reviews.length).toFixed(1);

                    reviews.forEach(review => {
                        if (review.rating >= 3) {
                            successfulDeals += 1;
                        } else if (review.rating > 0) {
                            unsuccessfulDeals += 1;
                        }
                    });
                }

                const totalDeals = successfulDeals + unsuccessfulDeals;
                const successRate = totalDeals > 0 ? ((successfulDeals / totalDeals) * 100).toFixed(1) : 0;
                const failureRate = totalDeals > 0 ? ((unsuccessfulDeals / totalDeals) * 100).toFixed(1) : 0;

                const accountInfo = `🔅ID пользователя: ${user.id}\n🌐Имя пользователя: @${user.username}\n💰Текущий баланс: ${user.balance} USDT\n\n⭐Средний рейтинг: ${averageRating}\n✅Успешные сделки: ${successRate}%\n❌Неуспешные сделки: ${failureRate}%`;

                const accountOptions = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [
                                { text: '➕Пополнить баланс', callback_data: 'replenish_balance' },
                                { text: '➖Вывести средства', callback_data: 'withdraw_balance' }
                            ],
                            [
                                { text: '⚡️Активная сделка', callback_data: 'active_deal' }
                            ]
                        ]
                    })
                };

                sendMessage(chatId, accountInfo, accountOptions);
            } else {
                sendMessage(chatId, "Пользователь не найден.");
            }
        }
    };

    if (commands[text]) commands[text]();
});


bot.onText(/\/showmenu/, (msg) => {
    const chatId = msg.chat.id;
    
    const menuOptions = {
        reply_markup: {
            keyboard: [
                ['🔍Найти пользователя', '💸Сделки'],
                ['💎Отзывы', '🧾Условия пользования ботом'],
                ['🪬Профиль']
            ],
            resize_keyboard: true, 
            one_time_keyboard: false
        }
    };

    sendMessage(chatId, "Меню открыто:", menuOptions);
});

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    if (data === 'active_deal') {

        const activeDeal = await Deal.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { buyerId: chatId.toString(), status: ['opened', 'spore', 'in progress'] },
                    { sellerId: chatId.toString(), status: ['opened', 'spore', 'in progress'] }
                ]
            },
            order: [['createdAt', 'DESC']]
        });

        if (!activeDeal) {
            bot.sendMessage(chatId, "У вас нет активных сделок.");
            return;
        }

        const otherPartyId = (activeDeal.buyerId === chatId.toString()) ? activeDeal.sellerId : activeDeal.buyerId;
        const otherParty = await User.findOne({ where: { chatId: otherPartyId } });
        const otherPartyUsername = otherParty ? `@${otherParty.username}` : 'Неизвестный пользователь';
        const userRole = activeDeal.buyerId === chatId.toString() ? 'Покупатель' : 'Продавец';

        const activeDealDetails = `⚡️Детали активной сделки #${activeDeal.id}:
💰Сумма: ${activeDeal.amount} USDT
🧾Описание: ${activeDeal.description}
📶Статус: ${activeDeal.status}
👤С кем сделка: ${otherPartyUsername}
🌐В этой сделке вы: ${userRole}`;

        const inlineKeyboard = [];

        if (activeDeal.status === 'opened') {
            inlineKeyboard.push([{ text: 'Отменить сделку', callback_data: `cancel_deal_${activeDeal.id}` }]);
        } else if (activeDeal.status !== 'closed' && activeDeal.status !== 'cancelled') {
            inlineKeyboard.push([{ text: 'Открыть спор по этой сделке', callback_data: `open_dispute_${activeDeal.id}` }]);
            inlineKeyboard.push([{ text: 'Закрыть сделку', callback_data: `close_deal_${activeDeal.id}` }]);
        }

        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: inlineKeyboard
            })
        };

        bot.sendMessage(chatId, activeDealDetails, options);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});


bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();

    if (query.data === 'replenish_balance') {
        if (userStates[chatId] && userStates[chatId].action === 'replenish_balance') {
            sendMessage(chatId, 'Вы уже находитесь в процессе пополнения. Введите сумму.');
            return;
        }

        userStates[chatId] = { action: 'replenish_balance' };
        sendMessage(chatId, 'Введите сумму для пополнения:');
    } else if (query.data === 'withdraw_balance') {
        if (userStates[chatId] && userStates[chatId].action === 'withdraw_balance') {
            sendMessage(chatId, 'Вы уже находитесь в процессе вывода. Введите сумму.');
            return;
        }

        userStates[chatId] = { action: 'withdraw_balance' };
        sendMessage(chatId, 'Введите сумму для вывода:');
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (userStates[chatId]) {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
        }

        if (userStates[chatId].action === 'replenish_balance') {
            await handleReplenishBalance(chatId, amount);
        } else if (userStates[chatId].action === 'withdraw_balance') {
            await handleWithdrawBalance(chatId, amount);
        }

        delete userStates[chatId];
    }
});

async function handleReplenishBalance(chatId, amount) {
    try {
        const invoice = await createInvoice(amount);
        const paymentUrl = invoice.bot_invoice_url;

        if (paymentUrl) {
            await bot.sendMessage(chatId, `Для пополнения баланса на ${amount} USD, перейдите по ссылке: ${paymentUrl}`);

            const checkPaymentStatus = async () => {
                try {
                    const isPaid = await checkInvoiceStatus(invoice.invoice_id);
                    if (isPaid) {
                        const commissionRate = 0.07;
                        const netAmount = amount * (1 - commissionRate); 
                        await updateUserBalance(chatId, netAmount);
                        await addTransaction(chatId, 'replenishment', netAmount);
                        await bot.sendMessage(chatId, `Баланс успешно пополнен на ${netAmount.toFixed(2)} USD (комиссия 7%).`);
                    } else {
                        setTimeout(checkPaymentStatus, 30000); 
                    }
                } catch (error) {
                    console.error('Ошибка при проверке статуса платежа:', error);
                }
            };
            setTimeout(checkPaymentStatus, 30000);
        } else {
            await bot.sendMessage(chatId, 'Не удалось создать ссылку для оплаты. Попробуйте еще раз.');
        }
    } catch (error) {
        console.error('Ошибка при пополнении баланса:', error);
        await bot.sendMessage(chatId, 'Ошибка при пополнении баланса. Попробуйте еще раз.');
    }
}

async function handleWithdrawBalance(chatId, amount) {
    try {
        const user = await checkUser(chatId);
        
        if (!user) {
            return sendMessage(chatId, "Пользователь не найден.");
        }

        const openDealsExist = await hasOpenDeals(user.id);
        if (openDealsExist) {
            return sendMessage(chatId, "Вы не можете вывести средства, пока у вас есть открытые сделки.");
        }

        if (user.balance < amount) {
            return sendMessage(chatId, "Недостаточно средств для вывода.");
        }

        console.log("Параметры для перевода:", {
            chat_id: user.chatId,
            asset: 'USDT',
            amount: amount.toString(),
            comment: 'Вывод средств из аккаунта'
        });

        const transferResult = await transfer(user.chatId, 'USDT', amount.toString(), {
            comment: 'Вывод средств из аккаунта'
        });

        if (transferResult.ok) {
            user.balance -= amount; 
            await user.save();

            sendMessage(chatId, `Вы успешно вывели ${amount} USDT!`);
        } else {
            sendMessage(chatId, 'Ошибка при выводе средств: ' + transferResult.error.name);
            console.error("Ошибка API при переводе:", transferResult.error.message);
        }
    } catch (error) {
        console.error('Ошибка при выводе средств:', error.message);
        sendMessage(chatId, 'Произошла ошибка при выводе средств. Попробуйте снова позже.');
    }
}


async function updateUserBalance(chatId, amount) {
    await User.increment({ balance: amount }, { where: { chatId: chatId.toString() } });
}

async function addTransaction(userId, type, amount) {
    await Transaction.create({ userId, type, amount });
}
bot.onText(/@(\w+)|\/findById (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const username = match[1];      
    const userId = match[2];        

    let user;

    if (username) {
        user = await User.findOne({ where: { username } });
    } else if (userId) {
        user = await User.findOne({ where: { id: userId } });
    }

    if (user) {
        const reviews = await Review.findAll({ where: { userId: user.id } });
        
        let successfulDeals = 0;
        let unsuccessfulDeals = 0;
        let averageRating = 0;

        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
            averageRating = (totalRating / reviews.length).toFixed(1);

            reviews.forEach(review => {
                if (review.rating >= 3) {
                    successfulDeals += 1;
                } else if (review.rating > 0) {
                    unsuccessfulDeals += 1;
                }
            });
        }

        const totalDeals = successfulDeals + unsuccessfulDeals;
        const successRate = totalDeals > 0 ? ((successfulDeals / totalDeals) * 100).toFixed(1) : 0;
        const failureRate = totalDeals > 0 ? ((unsuccessfulDeals / totalDeals) * 100).toFixed(1) : 0;

        const userInfo = `Пользователь: @${username || 'ID ' + user.id}\n\n` +
                         `👁‍🗨Всего сделок: ${totalDeals}\n` +
                         `✅Успешные сделки: ${successfulDeals} (${successRate}%)\n` +
                         `❌Неуспешные сделки: ${unsuccessfulDeals} (${failureRate}%)\n` +
                         `⭐️Средний рейтинг: ${averageRating}`;

        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: '💎Посмотреть отзывы о пользователе', callback_data: `reviews_${user.id}` }],
                    [{ text: '💸Предложить сделку', callback_data: `propose_deal_${user.id}` }]
                ]
            })
        };

        bot.sendMessage(chatId, userInfo, options);
    } else {
        bot.sendMessage(chatId, "Пользователь не найден.");
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id.toString(); 
    const messageId = callbackQuery.message.message_id; 

    const hasOpenDeals = async (userId) => {
        const openDealStatuses = ['in progress', 'spore'];
    
        const openDeals = await Deal.findOne({
            where: {
                [Sequelize.Op.or]: [
                    {
                        [Sequelize.Op.and]: [
                            { buyerId: userId },
                            { status: { [Sequelize.Op.in]: openDealStatuses } }
                        ]
                    },
                    {
                        [Sequelize.Op.and]: [
                            { sellerId: userId },
                            { status: { [Sequelize.Op.in]: openDealStatuses } }
                        ]
                    }
                ]
            }
        });
    
        console.log(`hasOpenDeals для пользователя ${userId}: ${openDeals ? 'да' : 'нет'}`);
    
        return openDeals !== null;
    }

    const hasOpenDeals2 = async (userId) => {
        const openDealStatuses = ['opened'];
    
        const openDeals = await Deal.findOne({
            where: {
                [Sequelize.Op.or]: [
                    {
                        [Sequelize.Op.and]: [
                            { buyerId: userId },
                            { status: { [Sequelize.Op.in]: openDealStatuses } }
                        ]
                    },
                    {
                        [Sequelize.Op.and]: [
                            { sellerId: userId },
                            { status: { [Sequelize.Op.in]: openDealStatuses } }
                        ]
                    }
                ]
            }
        });

        console.log(`hasOpenDeals для пользователя ${userId}: ${openDeals ? 'да' : 'нет'}`);
    
        return openDeals !== null;
    }

    if (data.startsWith('propose_deal_')) {
        const targetChatId = data.split('_')[2].toString(); 

        if (await hasOpenDeals2(chatId)) {
            bot.sendMessage(chatId, "У вас уже есть открытая сделка. Завершите ее перед созданием новой.");
            return;
        }

        if (await hasOpenDeals2(targetChatId)) {
            bot.sendMessage(chatId, "У пользователя уже есть открытая сделка. Попробуйте позже.");
            return;
        }

        const targetUser = await User.findOne({ where: { chatId: targetChatId } });
        if (!targetUser) {
            bot.sendMessage(chatId, "Пользователь не найден.");
            return;
        }

        const roleSelectionKeyboard = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: 'Я Покупатель', callback_data: `choose_buyer_${targetChatId}` }],
                    [{ text: 'Я Продавец', callback_data: `choose_seller_${targetChatId}` }]
                ]
            })
        };
        bot.sendMessage(chatId, "Выберите вашу роль в сделке:", roleSelectionKeyboard);
    }

    if (data.startsWith('choose_buyer_') || data.startsWith('choose_seller_')) {
        bot.deleteMessage(chatId, messageId).catch(error => console.error("Ошибка при удалении сообщения:", error));

        const role = data.startsWith('choose_buyer_') ? 'buyerId' : 'sellerId';
        const targetChatId = data.split('_')[2].toString();
        const roleName = role === 'buyerId' ? 'Покупателя' : 'Продавца';

        bot.sendMessage(chatId, `Вы выбрали роль ${roleName}.\n-Теперь введите сумму и описание сделки в формате:\n-'сумма описание' например:\n\n1000 Покупка товара`);

        const messageHandler = async (msg) => {
            if (msg.chat.id.toString() !== chatId) return;

            const [amountStr, ...descriptionParts] = msg.text.split(' ');
            const dealDescription = descriptionParts.join(' ');
            const amount = parseFloat(amountStr);
            const senderUsername = msg.from.username || "анонимный пользователь";

            if (isNaN(amount) || !dealDescription) {
                bot.sendMessage(chatId, "Некорректный формат. Попробуйте еще раз.");
                bot.removeListener('message', messageHandler);
                return;
            }

            const senderUser = await User.findOne({ where: { chatId: chatId } });
            if (!senderUser) {
                bot.sendMessage(chatId, "Ваш аккаунт не найден в системе. Пожалуйста, зарегистрируйтесь.");
                bot.removeListener('message', messageHandler);
                return;
            }

            if (role === 'buyerId' && senderUser.balance < amount) {
                const requiredAmount = (amount - senderUser.balance).toFixed(2);
                bot.sendMessage(chatId, `Недостаточно средств. Пополните баланс на ${requiredAmount} USDT.`);
                bot.removeListener('message', messageHandler);
                return;
            }

            const dealKey = `${chatId}_${targetChatId}_${Date.now()}`;
            const existingDeal = await Deal.findOne({ where: { dealKey } });

            if (existingDeal) {
                bot.sendMessage(chatId, "Такая сделка уже существует.");
                bot.removeListener('message', messageHandler);
                return;
            }

            try {
                const dealData = {
                    amount,
                    status: 'opened',
                    dealKey,
                    description: dealDescription
                };
                dealData[role] = chatId.toString();
                dealData[role === 'buyerId' ? 'sellerId' : 'buyerId'] = targetChatId.toString();

                await Deal.create(dealData);

                await DealAgreement.create({ dealKey, userId: chatId.toString(), agreed: false });
                await DealAgreement.create({ dealKey, userId: targetChatId.toString(), agreed: false });

                const options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: 'Принять сделку', callback_data: `accept_${dealKey}` }],
                            [{ text: 'Отклонить сделку', callback_data: `decline_${dealKey}` }]
                        ]
                    })
                };
                const targetUser2 = await User.findOne({ where: { chatId: targetChatId } });

                bot.sendMessage(targetChatId, `Пользователь @${senderUsername} предлагает сделку на сумму ${amount} USDT. Описание сделки: '${dealDescription}'`, options);
                bot.sendMessage(chatId, `Уведомление о сделке отправлено пользователю @${targetUser2.username}. Ожидайте ответа.`);
            } catch (error) {
                console.error("Ошибка при создании сделки:", error);
                bot.sendMessage(chatId, "Произошла ошибка при создании сделки. Пожалуйста, попробуйте еще раз.");
            } finally {
                bot.removeListener('message', messageHandler);
            }
        };

        bot.on('message', messageHandler);
    }


    if (data.startsWith('accept_') || data.startsWith('decline_')) {
        const dealKey = data.split('_')[1];
        const isAccepting = data.startsWith('accept_');
        const newStatus = isAccepting ? 'accepted' : 'declined';

        try {
            if (await hasOpenDeals(chatId)) {
                bot.sendMessage(chatId, "У вас уже есть открытая сделка. Завершите ее перед принятием новой.");
                return;
            }

            await Deal.update(
                { status: newStatus },
                { where: { dealKey } }
            );

            const message = isAccepting ? "Сделка принята." : "Сделка отклонена.";
            bot.sendMessage(chatId, message);
        } catch (error) {
            console.error(`Ошибка при обновлении сделки:`, error);
            bot.sendMessage(chatId, "Произошла ошибка при обновлении статуса сделки.");
        }
    }
});



bot.onText(/\/deal_(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString(); 
    const dealId = match[1];

    const deal = await Deal.findOne({ where: { id: dealId } });

    if (!deal) {
        bot.sendMessage(chatId, "Сделка не найдена.");
        return;
    }

    if (deal.buyerId !== chatId && deal.sellerId !== chatId) {
        bot.sendMessage(chatId, "У вас нет доступа к этой сделке.");
        return;
    }

    const otherPartyId = (deal.buyerId === chatId) ? deal.sellerId : deal.buyerId;
    const otherParty = await User.findOne({ where: { chatId: otherPartyId } });
    const otherPartyUsername = otherParty ? `@${otherParty.username}` : 'Неизвестный пользователь';

    const userRole = deal.buyerId === chatId ? 'Покупатель' : 'Продавец';

    const dealDetails = `Детали сделки #${deal.id}:
💰Сумма: ${deal.amount} USDT
🧾Описание: ${deal.description}
📶Статус: ${deal.status}
👤С кем сделка: ${otherPartyUsername}
🌐В этой сделке вы: ${userRole}`;

    const inlineKeyboard = [];
    
    if (deal.status === 'opened') {
        inlineKeyboard.push([{ text: 'Отменить сделку', callback_data: `cancel_deal_${deal.id}` }]);
    } else if (deal.status !== 'closed' && deal.status !== 'cancelled') {
        inlineKeyboard.push([{ text: 'Открыть спор по этой сделке', callback_data: `open_dispute_${deal.id}` }]);
        inlineKeyboard.push([{ text: 'Закрыть сделку', callback_data: `close_deal_${deal.id}` }]);
    }

    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: inlineKeyboard
        })
    };

    bot.sendMessage(chatId, dealDetails, options);
});

let awaitingReviews = {};

async function requestReview(fromUserId, dealId, toUserId) {
    awaitingReviews[fromUserId] = { dealId, toUserId }; 
    bot.sendMessage(fromUserId, `Оставьте ваш отзыв и рейтинг (от 1 до 5) для пользователя. Пример: "Отличная сделка, рекомендую! 5"`);
}

bot.on('message', async (msg) => {
    const fromUserId = msg.chat.id;

    if (awaitingReviews[fromUserId]) {
        const { dealId, toUserId } = awaitingReviews[fromUserId];
        const [reviewText, ratingStr] = msg.text.split(/(\d)$/).map(s => s.trim());
        const rating = parseInt(ratingStr);

        if (isNaN(rating) || rating < 1 || rating > 5 || !reviewText) {
            bot.sendMessage(fromUserId, "Некорректный формат. Пожалуйста, отправьте отзыв снова в формате: 'Текст отзыва Рейтинг'. Пример: 'Отличная сделка! 5'");
            return; 
        }

        try {
            await Review.create({
                userId: toUserId,
                dealId: dealId,
                content: reviewText,
                rating: rating
            });
            bot.sendMessage(fromUserId, "Спасибо за ваш отзыв!");
            delete awaitingReviews[fromUserId]; 
        } catch (error) {
            console.error("Ошибка при сохранении отзыва:", error);
            bot.sendMessage(fromUserId, "Ошибка при сохранении отзыва. Попробуйте еще раз.");
        }
    }
});

const admins = ["id админа"];

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const username = callbackQuery.from.username;

    if (data.startsWith('open_dispute_')) {
        const dealId = data.split('_')[2];

        const deal = await Deal.findOne({ where: { id: dealId } });

        if (!deal) {
            bot.sendMessage(chatId, "Сделка не найдена.");
            return;
        }

        if (deal.buyerId !== chatId.toString() && deal.sellerId !== chatId.toString()) {
            bot.sendMessage(chatId, "У вас нет доступа к этой сделке.");
            return;
        }

        await Deal.update({ status: 'spore', disputeInitiator: username }, { where: { id: dealId } });

        bot.sendMessage(deal.buyerId, `Ожидайте арбитра для решения спора по сделке #${dealId}. Спор инициирован пользователем @${username}.`);
        bot.sendMessage(deal.sellerId, `Ожидайте арбитра для решения спора по сделке #${dealId}. Спор инициирован пользователем @${username}.`);

        const disputeMessage = `
Спор по сделке #${dealId}.
Инициатор спора: @${username}
ID сделки: ${dealId}
Покупатель: ${deal.buyerId}
Продавец: ${deal.sellerId}
Описание: ${deal.description || "не указано"}
        `;

        for (const adminId of admins) {
            bot.sendMessage(adminId, disputeMessage);
        }
    } else if (data.startsWith('cancel_deal_')) {
        const dealId = data.split('_')[2];

        await Deal.update({ status: 'cancelled' }, { where: { id: dealId } });
        bot.sendMessage(chatId, `Сделка #${dealId} была отменена.`);

    } else if (data.startsWith('close_deal_')) {
        const dealId = data.split('_')[2];

        const deal = await Deal.findOne({ where: { id: dealId } });

        if (!deal) {
            bot.sendMessage(chatId, "Сделка не найдена.");
            return;
        }

        if (deal.buyerId !== chatId.toString() && deal.sellerId !== chatId.toString()) {
            bot.sendMessage(chatId, "У вас нет доступа к этой сделке.");
            return;
        }

        const otherPartyId = (deal.buyerId === chatId.toString()) ? deal.sellerId : deal.buyerId;

        bot.sendMessage(otherPartyId, `Пользователь @${callbackQuery.from.username} запросил закрытие сделки #${deal.id}.\nВы подтверждаете закрытие?`, {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: 'Подтвердить закрытие', callback_data: `confirm_close_${deal.id}` }],
                    [{ text: 'Отклонить закрытие', callback_data: `decline_close_${deal.id}` }]
                ]
            })
        });

        bot.sendMessage(chatId, "Запрос на закрытие сделки отправлен другому участнику. Ожидайте ответа.");

    } else if (data.startsWith('confirm_close_')) {
        const dealId = data.split('_')[2];

        const deal = await Deal.findOne({ where: { id: dealId } });

        if (!deal) {
            bot.sendMessage(chatId, "Сделка не найдена.");
            return;
        }

        const buyer = await User.findOne({ where: { chatId: deal.buyerId } });
        const seller = await User.findOne({ where: { chatId: deal.sellerId } });

        if (!buyer || !seller) {
            bot.sendMessage(chatId, "Ошибка при получении информации о пользователях.");
            return;
        }

        const dealAmount = parseFloat(deal.amount);
        if (isNaN(dealAmount)) {
            bot.sendMessage(chatId, "Ошибка: некорректная сумма сделки.");
            return;
        }

        const t = await sequelize.transaction();

        try {
            if (buyer.balance < dealAmount) {
                bot.sendMessage(chatId, "Недостаточно средств на балансе покупателя для закрытия сделки.");
                await t.rollback();
                return;
            }

            buyer.balance = parseFloat(buyer.balance) - dealAmount;
            await buyer.save({ transaction: t });

            seller.balance = parseFloat(seller.balance) + dealAmount;
            await seller.save({ transaction: t });

            await Deal.update({ status: 'closed' }, { where: { id: dealId }, transaction: t });

            await t.commit();

            bot.sendMessage(deal.buyerId, `Сделка #${dealId} была закрыта по обоюдному согласию.`);
            bot.sendMessage(deal.sellerId, `Сделка #${dealId} была закрыта по обоюдному согласию.`);

            setTimeout(async () => {
                await requestReview(deal.buyerId, dealId, deal.sellerId);
                await requestReview(deal.sellerId, dealId, deal.buyerId);
            }, 1000);

        } catch (error) {
            console.error("Ошибка при закрытии сделки:", error);
            await t.rollback();
            bot.sendMessage(chatId, "Произошла ошибка при закрытии сделки. Попробуйте еще раз.");
        }

    } else if (data.startsWith('decline_close_')) {
        const dealId = data.split('_')[2];

        const deal = await Deal.findOne({ where: { id: dealId } });

        if (!deal) {
            bot.sendMessage(chatId, "Сделка не найдена.");
            return;
        }

        const initiatorId = (deal.buyerId === callbackQuery.message.chat.id.toString()) ? deal.sellerId : deal.buyerId;
        bot.sendMessage(initiatorId, `Ваш запрос на закрытие сделки #${dealId} был отклонен другим участником.`);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});



bot.onText(/\/make_deal @(\w+) (\d+(?:\.\d{1,2})?) (.+)/, async (msg, match) => {
    const [_, targetUsername, amount, dealDescription] = match;
    const chatId = msg.chat.id;
    const senderUsername = msg.from.username || "анонимный пользователь";
    const targetChatId = await findUserChatId(targetUsername);

    if (targetChatId) {
        const dealKey = `${chatId}_${targetChatId}_${Date.now()}`;
        const existingDeal = await Deal.findOne({ where: { dealKey } });
        if (existingDeal) {
            bot.sendMessage(chatId, "Такая сделка уже существует.");
            return;
        }

        await Deal.create({
            buyerId: chatId.toString(),
            sellerId: targetChatId.toString(),
            amount,
            status: 'opened',
            dealKey
        });

        await DealAgreement.create({ dealKey, userId: chatId.toString(), agreed: false });
        await DealAgreement.create({ dealKey, userId: targetChatId.toString(), agreed: false });

        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: 'Принять сделку', callback_data: `accept_${dealKey}` }],
                    [{ text: 'Отклонить сделку', callback_data: `decline_${dealKey}` }]
                ]
            })
        };
        bot.sendMessage(targetChatId, `Пользователь @${senderUsername} предлагает сделку на сумму ${amount} USDT. Описание сделки: '${dealDescription}'`, options);
        bot.sendMessage(chatId, `Уведомление о сделке отправлено пользователю @${targetUsername}. Ожидайте ответа.`);
    } else {
        bot.sendMessage(chatId, `Пользователь @${targetUsername} не найден.`);
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const dealKeyMatch = data.match(/(\d+_\d+_\d+)$/);
    const dealKey = dealKeyMatch ? dealKeyMatch[0] : null;
    const action = dealKey ? data.slice(0, data.lastIndexOf(dealKey) - 1) : data;

    const responderChatId = callbackQuery.message.chat.id;
    
    const deal = await Deal.findOne({ where: { dealKey } });

    const responderUser = await User.findOne({ where: { chatId: responderChatId.toString() } });

    if (!responderUser) {
        bot.sendMessage(responderChatId, "Ваш аккаунт не найден в системе.");
        return;
    }

    if (action === 'accept' && deal.status === 'opened') {

        const userBalance = parseFloat(responderUser.balance);
        const dealAmount = parseFloat(deal.amount);

        if (deal.buyerId === responderChatId.toString() && userBalance < dealAmount) {
            const requiredAmount = (dealAmount - userBalance).toFixed(2);
            bot.sendMessage(responderChatId, `Недостаточно средств для принятия сделки. Пополните баланс на ${requiredAmount} USDT.`);
            return;
        }

        deal.status = 'in progress';
        await deal.save();

        bot.sendMessage(deal.buyerId, `Ваша сделка на сумму ${dealAmount} USDT была принята.`);
        bot.sendMessage(deal.sellerId, `Ваша сделка на сумму ${dealAmount} USDT была принята.`);
    }
    else if (action === 'decline' && deal.status === 'opened') {
        deal.status = 'cancelled';
        await deal.save();

        bot.sendMessage(deal.buyerId, "Ваша сделка была отклонена.");
        bot.sendMessage(deal.sellerId, "Ваша сделка была отклонена.");
    }
    else if (action === 'finish' && deal.status === 'in progress') {
        const otherPartyId = deal.buyerId === responderChatId.toString() ? deal.sellerId : deal.buyerId;

        bot.sendMessage(otherPartyId, "Согласны ли вы завершить сделку?", {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: 'Принять', callback_data: `confirm_finish_${dealKey}` }],
                    [{ text: 'Отклонить', callback_data: `deny_finish_${dealKey}` }]
                ]
            })
        });
        bot.sendMessage(responderChatId, "Ожидайте согласия другой стороны.");
    }
    else if (action === 'confirm_finish' && deal.status === 'in progress') {
        deal.status = 'closed';
        await deal.save();

        bot.sendMessage(deal.buyerId, "Сделка успешно завершена.");
        bot.sendMessage(deal.sellerId, "Сделка успешно завершена.");
    }
    else if (action === 'deny_finish') {
        bot.sendMessage(deal.buyerId, "Сделка не была завершена. Отказ другой стороны.");
        bot.sendMessage(deal.sellerId, "Сделка не была завершена. Отказ другой стороны.");
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

async function findUserChatId(username) {
    username = normalizeUsername(username);
    const user = await User.findOne({ where: { username } });
    return user ? user.chatId : null;
}

async function checkUserExists(chatId) {
    const user = await User.findOne({ where: { id: chatId.toString() } });
    return user !== null;
}

app.listen(PORT, () => {
    console.log(`Server is running and webhook is listening on port ${PORT}`);
});

module.exports = { start: () => bot.startPolling() };