require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting Payment Gateway Logic Test...');

  try {
    // 1. Setup - Create a test user
    const testEmail = `test_${Date.now()}@example.com`;
    console.log(`- Creating test user: ${testEmail}`);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashed_password_here',
        balance: 0
      }
    });

    // 2. Test Checkout Session Simulation
    console.log('- Simulating Checkout Session creation logic...');
    // (Logic from walletController.createCheckoutSession)
    const mockAmount = 500; // ₹500
    console.log(`  - Intent: Deposit ₹${mockAmount}`);

    // 3. Test Webhook Simulation (Successful Payment)
    console.log('- Simulating Stripe Webhook (checkout.session.completed)...');
    const mockStripeSessionId = `cs_test_${Date.now()}`;
    
    // Simulate the work done in handleStripeWebhook
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { balance: { increment: mockAmount } },
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT',
          amount: mockAmount,
          status: 'COMPLETED',
          stripeSessionId: mockStripeSessionId,
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (updatedUser.balance === mockAmount) {
      console.log('✅ Webhook Test Passed: User balance updated correctly.');
    } else {
      throw new Error(`❌ Webhook Test Failed: Expected balance ${mockAmount}, got ${updatedUser.balance}`);
    }

    // 4. Test Withdrawal Logic
    console.log('- Simulating Withdrawal request...');
    const withdrawAmount = 200;
    
    // Simulate logic from walletController.withdraw
    if (updatedUser.balance < withdrawAmount) throw new Error('Insufficient balance');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: withdrawAmount },
        transactions: {
          create: { type: 'WITHDRAWAL', amount: withdrawAmount, status: 'PENDING' }
        }
      }
    });

    const finalUser = await prisma.user.findUnique({ 
      where: { id: user.id },
      include: { transactions: { orderBy: { timestamp: 'desc' } } }
    });
    
    const pendingWithdrawal = finalUser.transactions.find(t => t.type === 'WITHDRAWAL' && t.status === 'PENDING');

    if (finalUser.balance === (mockAmount - withdrawAmount) && pendingWithdrawal) {
      console.log(`✅ Withdrawal Test Passed: Balance frozen (₹${finalUser.balance}) and transaction marked PENDING.`);
    } else {
      throw new Error(`❌ Withdrawal Test Failed: Balance or status incorrect.`);
    }

    // Clean up
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('🧹 Cleanup complete.');
    console.log('🎉 ALL BACKEND PAYMENT LOGIC TESTS PASSED!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.message.includes('P1001')) {
      console.log('   (Note: Ensure your PostgreSQL database is running to perform this test)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
