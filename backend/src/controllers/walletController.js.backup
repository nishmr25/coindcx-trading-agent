const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getBalance = async (req, res) => {
  try {
    // Get the first user (master user) as the default user for the pooled fund
    const user = await prisma.user.findFirst();
    if (!user) {
      return res.status(404).json({ message: 'No user found' });
    }
    res.json({ 
      balance: user.balance, 
      totalProfit: user.totalProfit, 
      transactions: [] // We are not handling transactions anymore
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getBalance };
