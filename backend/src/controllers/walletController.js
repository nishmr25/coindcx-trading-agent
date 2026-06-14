const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const deposit = async (req, res) => {
  const { amount } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        balance: { increment: parseFloat(amount) },
        transactions: {
          create: { type: 'DEPOSIT', amount: parseFloat(amount) }
        }
      }
    });
    res.json({ balance: user.balance, message: 'Deposit successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const withdraw = async (req, res) => {
  const { amount } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        balance: { decrement: parseFloat(amount) },
        transactions: {
          create: { type: 'WITHDRAWAL', amount: parseFloat(amount) }
        }
      }
    });
    res.json({ balance: updatedUser.balance, message: 'Withdrawal successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBalance = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { transactions: { orderBy: { timestamp: 'desc' }, take: 10 } }
    });
    res.json({ balance: user.balance, totalProfit: user.totalProfit, transactions: user.transactions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { deposit, withdraw, getBalance };
