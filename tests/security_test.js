import { validateUrl } from '../src/core/security.js';

async function runTests() {
  console.log('🛡️ Starting Security Validation Tests...');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    console.log(`\n🔹 Running: ${name}...`);
    try {
      await fn();
      console.log(`✅ ${name} Passed`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name} Failed:`, error.message);
      failed++;
    }
  }

  // 1. Valid Public URL
  await test('Valid Public URL (google.com)', async () => {
    // We assume google.com resolves to a public IP
    await validateUrl('https://google.com');
  });

  // 2. Localhost
  await test('Block Localhost', async () => {
    try {
      await validateUrl('http://localhost');
      throw new Error('Should have blocked localhost');
    } catch (error) {
      if (!error.message.includes('Blocked IP range') && !error.message.includes('loopback')) {
           // If it failed for another reason (e.g. DNS failure), that's also acceptable security-wise,
           // but we want to confirm it caught the IP range if it resolved.
           // On some systems localhost might not resolve via dns.resolve?
           // Actually dns.resolve('localhost') often works.
           // But if it fails to resolve, validateUrl throws "DNS resolution failed", which is safe.
           if (error.message.includes('DNS resolution failed')) {
               console.log("   (DNS resolution failed for localhost, considering safe)");
               return;
           }
           throw error;
      }
    }
  });

  // 3. Loopback IP
  await test('Block 127.0.0.1', async () => {
    try {
      await validateUrl('http://127.0.0.1');
      throw new Error('Should have blocked 127.0.0.1');
    } catch (error) {
      if (!error.message.includes('Blocked IP range')) throw error;
    }
  });

  // 4. Private IP
  await test('Block 192.168.1.1', async () => {
    try {
      await validateUrl('http://192.168.1.1');
      throw new Error('Should have blocked 192.168.1.1');
    } catch (error) {
      if (!error.message.includes('Blocked IP range')) throw error;
    }
  });

  // 5. Cloud Metadata (AWS)
  await test('Block AWS Metadata (169.254.169.254)', async () => {
    try {
      await validateUrl('http://169.254.169.254');
      throw new Error('Should have blocked AWS Metadata');
    } catch (error) {
      if (!error.message.includes('Blocked IP range')) throw error;
    }
  });

  // 6. Invalid Protocol
  await test('Block File Protocol', async () => {
    try {
      await validateUrl('file:///etc/passwd');
      throw new Error('Should have blocked file protocol');
    } catch (error) {
      if (!error.message.includes('Invalid protocol')) throw error;
    }
  });

  // 7. Invalid URL
  await test('Block Invalid URL', async () => {
    try {
      await validateUrl('not-a-url');
      throw new Error('Should have blocked invalid URL');
    } catch (error) {
      if (!error.message.includes('Invalid URL')) throw error;
    }
  });

  // 8. 0.0.0.0
  await test('Block 0.0.0.0', async () => {
      try {
        await validateUrl('http://0.0.0.0');
        throw new Error('Should have blocked 0.0.0.0');
      } catch (error) {
        if (!error.message.includes('Blocked IP range')) throw error;
      }
    });

  console.log('\n📊 Security Test Summary');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
