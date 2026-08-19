/**
 * Deploys contracts/Helm.py to a GenLayer network and writes the resulting
 * address into frontend/lib/contracts.ts.
 *
 * Usage:
 *   HELM_DEPLOYER_PRIVATE_KEY=0x... npx tsx deploy/001_deploy_helm.ts [network]
 *
 * network defaults to "bradbury" (testnetBradbury). Pass "studio" for
 * studionet, or "asimov" for testnetAsimov.
 *
 * This script is never run automatically by any other part of this repo --
 * see CLAUDE.md's "Deployment / GitHub / Vercel" section. A human runs it
 * deliberately, with a deliberately-funded deployer key.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTRACT_PATH = join(ROOT, "contracts", "Helm.py");
const CONTRACTS_TS_PATH = join(ROOT, "frontend", "lib", "contracts.ts");

const NETWORKS = {
  bradbury: { chain: testnetBradbury, addressKey: "bradbury" as const },
  studio: { chain: studionet, addressKey: "studio" as const },
  asimov: { chain: testnetAsimov, addressKey: "asimov" as const },
};

type NetworkArg = keyof typeof NETWORKS;

// Deliberately excludes ACCEPTED -- ACCEPTED can still be appealed and
// reversed before FINALIZED, and this script writes the resulting address
// straight into frontend/lib/contracts.ts, which the frontend then treats
// as the live contract. Recording an address that gets reversed on appeal
// would silently point the whole app at a dead contract. This is a
// one-shot CLI deploy, not a live polling UX with a latency budget to
// protect, so there is no real cost to waiting for the fully-settled
// outcome. LEADER_TIMEOUT/VALIDATORS_TIMEOUT are real, already-decided
// terminal outcomes too -- included so a real timeout fails fast with a
// clear status instead of grinding through the full poll budget first.
const TERMINAL_STATUSES = new Set([
  TransactionStatus.FINALIZED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.CANCELED,
  TransactionStatus.LEADER_TIMEOUT,
  TransactionStatus.VALIDATORS_TIMEOUT,
]);

async function pollUntilTerminal(
  client: ReturnType<typeof createClient>,
  hash: `0x${string}`,
  { intervalMs = 3000, maxAttempts = 100 } = {}
) {
  let lastStatus: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const transaction = await client.getTransaction({ hash });
    const status = transaction.statusName ?? TransactionStatus.PENDING;
    if (status !== lastStatus) {
      console.log(`  status: ${status}`);
      lastStatus = status;
    }
    if (TERMINAL_STATUSES.has(status)) return transaction;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for deployment to reach a terminal status");
}

async function main() {
  const networkArg = (process.argv[2] ?? "bradbury") as NetworkArg;
  const network = NETWORKS[networkArg];
  if (!network) {
    throw new Error(`Unknown network "${networkArg}". Valid: ${Object.keys(NETWORKS).join(", ")}`);
  }

  const privateKey = process.env.HELM_DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error("Set HELM_DEPLOYER_PRIVATE_KEY to a 0x-prefixed private key before deploying.");
  }

  const account = createAccount(privateKey);
  const client = createClient({ chain: network.chain, account });

  const source = await readFile(CONTRACT_PATH, "utf-8");

  console.log(`Deploying contracts/Helm.py to ${network.chain.name} as ${account.address}...`);
  const hash = await client.deployContract({ code: source });
  console.log(`Deploy tx: ${hash}`);

  const transaction = await pollUntilTerminal(client, hash);

  if (transaction.statusName !== TransactionStatus.FINALIZED) {
    throw new Error(`Deployment did not finalize (status: ${transaction.statusName}).`);
  }

  const deployedAddress = transaction.to_address ?? transaction.recipient;
  if (!deployedAddress) {
    throw new Error("Deployment succeeded but no contract address was returned in the receipt.");
  }

  const contractsTs = await readFile(CONTRACTS_TS_PATH, "utf-8");
  const updated = contractsTs.replace(
    new RegExp(`(${network.addressKey}:\\s*)undefined`),
    `$1"${deployedAddress}"`
  );
  if (updated === contractsTs) {
    console.warn(
      `Warning: could not find a "${network.addressKey}: undefined" entry to update in ${CONTRACTS_TS_PATH} -- update it manually.`
    );
  } else {
    await writeFile(CONTRACTS_TS_PATH, updated);
    console.log(`Written to frontend/lib/contracts.ts under "${network.addressKey}".`);
  }

  console.log(`\nDeployed Helm at ${deployedAddress}`);
  console.log(`Deploy tx hash: ${hash}`);
  const explorer = network.chain.blockExplorers?.default?.url;
  if (explorer) console.log(`Explorer: ${explorer}address/${deployedAddress}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
