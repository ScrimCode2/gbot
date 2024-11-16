
const express = require('express');
const { User } = require('./models');
const router = express.Router();

router.post('/crypto-bot-webhook', async (req, res) => {
    const { invoice_id, status, amount, currency, user_id } = req.body;

    if (status === 'paid' && currency === 'USD') {
        const user = await User.findOne({ where: { chatId: user_id.toString() } });
        
        if (user) {
            user.balance = parseFloat(user.balance) + parseFloat(amount);
            await user.save();

            console.log(`Баланс пользователя @${user.username} пополнен на ${amount} USD`);
        }
    }

    res.sendStatus(200);
});

module.exports = router;
