const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeFiles = [
  'src/services/AttestcoinService.ts',
  'src/routes/loans.routes.ts',
  'src/routes/artefacts.routes.ts',
  'src/services/AssessmentService.ts',
];
const source = runtimeFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

assert.equal(/BORROWER_PK|LENDER_PK/.test(source), false);
assert.equal(/new ethers\.Wallet/.test(source), false);
assert.equal(/USE_REAL_NETWORK|USE_REAL_ATTESTCOIN/.test(source), false);
assert.equal(/mockResult|0xMock|0xmock|CONFIRMED/.test(source), false);
assert.match(source, /PROOF_READY/);

console.log('Live guard tests passed: backend runtime has no user private-key signing or synthetic confirmation path.');
