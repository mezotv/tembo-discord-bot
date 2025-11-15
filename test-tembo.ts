// Quick test to verify Tembo API key works
import Tembo from '@tembo-io/sdk';

const apiKey = process.env.TEMBO_API_KEY;

if (!apiKey) {
  console.error('❌ TEMBO_API_KEY not found in environment');
  process.exit(1);
}

console.log('🔑 Testing Tembo API key...');
console.log(`Key starts with: ${apiKey.substring(0, 10)}...`);

const client = new Tembo({ apiKey });

try {
  console.log('📡 Calling Tembo API...');
  const userInfo = await client.me.retrieve();
  console.log('✅ Tembo API key is valid!');
  console.log('User info:', userInfo);
} catch (error) {
  console.error('❌ Tembo API error:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
  }
  process.exit(1);
}

