const { sequelize, Sequelize } = require('./db');

const User = sequelize.define('user', {
    id: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    chatId: {
        type: Sequelize.STRING
    }
});

const Deal = sequelize.define('deal', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    buyerId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    sellerId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'opened'
    },
    dealKey: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    disputeInitiator: {
        type: Sequelize.STRING,
        allowNull: true
    }
});


const Transaction = sequelize.define('transaction', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    }
});

const Review = sequelize.define('review', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    dealId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'deals',
            key: 'id'
        }
    },
    content: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    rating: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
});



const DealAgreement = sequelize.define('dealAgreement', {
    dealKey: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    userId: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    agreed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});

module.exports = { User, Deal, Transaction, Review, DealAgreement };