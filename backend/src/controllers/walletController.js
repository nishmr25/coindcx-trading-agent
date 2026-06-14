const { PrismaClient } = require('@prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

const createCheckoutSession = async (req, res) => {
  const { amount } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Fund Deposit',
              description: `Deposit to Apex Pooled Fund for ${req.user.email}`,
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Stripe uses paisa for INR
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?canceled=true`,
      metadata: {
        userId: req.user.id,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = session.amount_total / 100; // Back to INR

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: 'DEPOSIT',
            amount,
            status: 'COMPLETED',
            stripeSessionId: session.id,
          },
        }),
      ]);
      console.log(`💰 Deposit verified for user ${userId}: ₹${amount}`);
    } catch (err) {
      console.error('Failed to update balance after webhook:', err.message);
    }
  }

  res.json({ received: true });
};

const withdraw = async (req, res) => {
  const { amount } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

    // Deduct balance and create PENDING transaction
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        balance: { decrement: parseFloat(amount) },
        transactions: {
          create: { type: 'WITHDRAWAL', amount: parseFloat(amount), status: 'PENDING' }
        }
      }
    });
    res.json({ balance: updatedUser.balance, message: 'Withdrawal request submitted for review' });
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

module.exports = { createCheckoutSession, handleStripeWebhook, withdraw, getBalance };
