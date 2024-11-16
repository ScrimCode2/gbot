const { User } = require('./models');

async function addUser(userData) {
    try {
        const user = await User.create({
            id: userData.id,
            username: userData.username,
            balance: userData.balance,
            chatId: userData.chatId
        });
        return user;
    } catch (error) {
        console.error("Error adding user:", error);
        return null;
    }
}
module.exports = { addUser };
