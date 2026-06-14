const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTrades = async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    res.json(trades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTrades };
