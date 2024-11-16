import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export async function createInvoice(amount) {
    if (amount === undefined) {
        throw new Error('Сумма должна быть указана'); 
    }

    const API_URL = 'https://pay.crypt.bot/api/createInvoice'; 
    const token = <твой токен CryptoPay>;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Crypto-Pay-API-Token': token
        },
        body: JSON.stringify({
            amount: amount.toString(),
            currency_type: 'crypto',
            asset: 'USDT', 
            description: 'Оплата за услугу',
            allow_comments: true,
            allow_anonymous: false, 
            expires_in: 3600 
        })
    });

    const data = await response.json();

    console.log("Ответ от API:", data); 
    if (data.ok) {
        return data.result;
    } else {
        throw new Error(`Ошибка API: ${data.error.name} - ${data.error.message || "неизвестная ошибка"}`);
    }
};

export async function checkInvoiceStatus(invoiceId) {
    const API_URL = `https://pay.crypt.bot/api/getInvoices?invoice_ids=${invoiceId}`;
    const token = '286579:AAtvjMupO18C0uwzBbk4u8YV4f1G9x19LBr';

    console.log("Запрос к API:", API_URL); 

    const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
            'Crypto-Pay-API-Token': token,
        }
    });

    const data = await response.json();

    console.log("Ответ от API проверки статуса:", data); 

    if (data.ok && Array.isArray(data.result.items) && data.result.items.length > 0) {
        const invoice = data.result.items[0]; 

        if (invoice.status === 'paid') {
            return true; 
        } else {
            return false;
        }
    } else {
        console.error("Ошибка: Инвойс не найден или запрос не успешен.", data);
        return false; 
    }
}


export async function transfer(chatId, asset, amount, options = {}) {
    const API_URL = 'https://pay.crypt.bot/api/transfer';
    const token = '286579:AAtvjMupO18C0uwzBbk4u8YV4f1G9x19LBr';

    const spend_id = uuidv4(); 

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Crypto-Pay-API-Token': token
        },
        body: JSON.stringify({
            user_id: chatId.toString(),
            asset: asset,
            amount: amount.toString(),
            spend_id: spend_id, 
            // comment: options.comment || ''
        })
    });

    const data = await response.json();

    console.log("Ответ от API при переводе:", data);

    if (data.ok) {
        return { ok: true, result: data.result };
    } else {
        return { ok: false, error: data.error };
    }
}
