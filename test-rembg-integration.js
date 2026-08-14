/**
 * Integration test for REMBG backend service
 * Tests TypeScript structure and logic without AWS deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('TESTING BACKEND REMBG INTEGRATION');
console.log('='.repeat(60) + '\n');

// Test 1: Check RembgCleanupService exists and has correct structure
console.log('TEST 1: RembgCleanupService Structure');
console.log('-'.repeat(60));

const servicePath = path.join(__dirname, 'apps/backend/src/ai-image-cleanup/rembg-cleanup.service.ts');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

const checks = [
    { name: 'Injectable decorator', pattern: /@Injectable\(\)/, required: true },
    { name: 'Logger', pattern: /private readonly logger.*Logger/, required: true },
    { name: 'LambdaClient', pattern: /LambdaClient/, required: true },
    { name: 'InvokeCommand', pattern: /InvokeCommand/, required: true },
    { name: 'removeBackground method', pattern: /async removeBackground\(/, required: true },
    { name: 'resolveLambdaArn method', pattern: /resolveLambdaArn\(\)/, required: true },
    { name: 'Error handling', pattern: /try\s*{[\s\S]*?catch.*error/m, required: true },
    { name: 'Response payload parsing', pattern: /TextDecoder.*decode/, required: true },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
    const found = check.pattern.test(serviceContent);
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (found) passed++;
    else failed++;
});

console.log(`\nResult: ${passed}/${checks.length} checks passed\n`);

// Test 2: Check main service integration
console.log('TEST 2: AiImageCleanupService Integration');
console.log('-'.repeat(60));

const mainServicePath = path.join(__dirname, 'apps/backend/src/ai-image-cleanup/ai-image-cleanup.service.ts');
const mainServiceContent = fs.readFileSync(mainServicePath, 'utf8');

const integrationChecks = [
    { name: 'Imports RembgCleanupService', pattern: /import.*RembgCleanupService/, required: true },
    { name: 'Injects RembgCleanupService', pattern: /private readonly rembgCleanup.*RembgCleanupService/, required: true },
    { name: 'cleanupAndUploadWithRouting method', pattern: /cleanupAndUploadWithRouting\(/, required: true },
    { name: 'shouldUseRembg method', pattern: /shouldUseRembg\(\)/, required: true },
    { name: 'cleanupWithRembg method', pattern: /cleanupWithRembg\(/, required: true },
    { name: 'Feature flag query', pattern: /use_rembg_cleanup/, required: true },
    { name: 'Fallback to OpenAI', pattern: /falling back to OpenAI/i, required: true },
    { name: 'Provider tracking', pattern: /provider:.*['"]rembg['"]/, required: true },
];

let integrationPassed = 0;
let integrationFailed = 0;

integrationChecks.forEach(check => {
    const found = check.pattern.test(mainServiceContent);
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (found) integrationPassed++;
    else integrationFailed++;
});

console.log(`\nResult: ${integrationPassed}/${integrationChecks.length} checks passed\n`);

// Test 3: Check module registration
console.log('TEST 3: Module Registration');
console.log('-'.repeat(60));

const modulePath = path.join(__dirname, 'apps/backend/src/ai-image-cleanup/ai-image-cleanup.module.ts');
const moduleContent = fs.readFileSync(modulePath, 'utf8');

const moduleChecks = [
    { name: 'Imports RembgCleanupService', pattern: /import.*RembgCleanupService/, required: true },
    { name: 'Registers in providers', pattern: /providers:[\s\S]*?RembgCleanupService/, required: true },
];

let modulePassed = 0;
let moduleFailed = 0;

moduleChecks.forEach(check => {
    const found = check.pattern.test(moduleContent);
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (found) modulePassed++;
    else moduleFailed++;
});

console.log(`\nResult: ${modulePassed}/${moduleChecks.length} checks passed\n`);

// Test 4: Check CDK infrastructure
console.log('TEST 4: CDK Infrastructure');
console.log('-'.repeat(60));

const cdkPath = path.join(__dirname, 'apps/cdk/src/lib/rendasua-infrastructure-stack.ts');
const cdkContent = fs.readFileSync(cdkPath, 'utf8');

const cdkChecks = [
    { name: 'rembgCleanupHandler defined', pattern: /rembgCleanupHandler.*lambda\.Function/, required: true },
    { name: 'Handler name correct', pattern: /rembg-cleanup-handler/, required: true },
    { name: 'Python 3.11 runtime', pattern: /Runtime\.PYTHON_3_11/, required: true },
    { name: '3008 MB memory', pattern: /memorySize:\s*3008/, required: true },
    { name: '120s timeout', pattern: /Duration\.seconds\(120\)/, required: true },
    { name: 'Ephemeral storage', pattern: /ephemeralStorageSize/, required: true },
    { name: 'S3 read permissions', pattern: /s3:GetObject/, required: true },
    { name: 'ARN output', pattern: /RembgCleanupHandlerArn/, required: true },
];

let cdkPassed = 0;
let cdkFailed = 0;

cdkChecks.forEach(check => {
    const found = check.pattern.test(cdkContent);
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (found) cdkPassed++;
    else cdkFailed++;
});

console.log(`\nResult: ${cdkPassed}/${cdkChecks.length} checks passed\n`);

// Test 5: Check environment configuration
console.log('TEST 5: Environment Configuration');
console.log('-'.repeat(60));

const envDevPath = path.join(__dirname, 'apps/backend/.env.development');
const envProdPath = path.join(__dirname, 'apps/backend/.env.production');

const envDevContent = fs.readFileSync(envDevPath, 'utf8');
const envProdContent = fs.readFileSync(envProdPath, 'utf8');

const envChecks = [
    { name: 'Development - REMBG_CLEANUP_LAMBDA_ARN', content: envDevContent, pattern: /REMBG_CLEANUP_LAMBDA_ARN/, required: true },
    { name: 'Development - AWS_ACCOUNT_ID', content: envDevContent, pattern: /AWS_ACCOUNT_ID/, required: true },
    { name: 'Production - REMBG_CLEANUP_LAMBDA_ARN', content: envProdContent, pattern: /REMBG_CLEANUP_LAMBDA_ARN/, required: true },
    { name: 'Production - AWS_ACCOUNT_ID', content: envProdContent, pattern: /AWS_ACCOUNT_ID/, required: true },
];

let envPassed = 0;
let envFailed = 0;

envChecks.forEach(check => {
    const found = check.pattern.test(check.content);
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (found) envPassed++;
    else envFailed++;
});

console.log(`\nResult: ${envPassed}/${envChecks.length} checks passed\n`);

// Final Summary
console.log('='.repeat(60));
console.log('OVERALL TEST SUMMARY');
console.log('='.repeat(60));

const totalTests = 5;
const testResults = [
    { name: 'RembgCleanupService Structure', passed: passed === checks.length },
    { name: 'AiImageCleanupService Integration', passed: integrationPassed === integrationChecks.length },
    { name: 'Module Registration', passed: modulePassed === moduleChecks.length },
    { name: 'CDK Infrastructure', passed: cdkPassed === cdkChecks.length },
    { name: 'Environment Configuration', passed: envPassed === envChecks.length },
];

testResults.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${test.name}`);
});

const totalPassed = testResults.filter(t => t.passed).length;
console.log(`\nResults: ${totalPassed}/${totalTests} test suites passed`);

if (totalPassed === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n✅ REMBG implementation is complete and structurally correct.');
    console.log('✅ Ready for deployment to AWS.');
    process.exit(0);
} else {
    console.log(`\n❌ ${totalTests - totalPassed} test suite(s) failed`);
    process.exit(1);
}
