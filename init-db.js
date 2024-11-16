const { sequelize } = require('./db');
const { User, Deal, Transaction, Review, DealAgreement } = require('./models');

async function createTables() {
    try {
        await User.sync({ force: true });
        await Deal.sync({ force: true });
        await Transaction.sync({ force: true });
        await Review.sync({ force: true });
        await DealAgreement.sync({ force: true });
        console.log("Все таблицы успешно созданы.");
    } catch (error) {
        console.error("Ошибка при создании таблиц:", error);
    }
}

createTables();
