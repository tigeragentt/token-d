/**
 * Helper script: encode a transfer() calldata and POST it to the workflow-xdc HTTP trigger.
 *
 * Usage:
 *   bun run trigger-transfer.ts <triggerUrl> <recipientAddress> <amount>
 *
 * Examples:
 *   bun run trigger-transfer.ts https://cre.chain.link/trigger/... 0xAbc...123 1000000000000000000
 *
 * Args:
 *   triggerUrl         — HTTP trigger URL from `cre workflow deploy` output
 *   recipientAddress   — address to transfer tokens to
 *   amount             — amount in wei (no decimals)
 *
 * The token contract on XDC Apothem is: 0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9
 */

import { encodeFunctionData, parseAbi, parseUnits } from "viem"

const TOKEN_ADDRESS = "0xD262aF97A79F7AbFF1a1Ff301a0464dBF242Dbe9"
const GAS_LIMIT = 100_000

const [, , triggerUrl, recipient, rawAmount] = process.argv

if (!triggerUrl || !recipient || !rawAmount) {
  console.error("Usage: bun run trigger-transfer.ts <triggerUrl> <recipientAddress> <amountInWei>")
  console.error("Example: bun run trigger-transfer.ts https://... 0xAbc...123 1000000000000000000")
  process.exit(1)
}

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
])

const data = encodeFunctionData({
  abi: erc20Abi,
  functionName: "transfer",
  args: [recipient as `0x${string}`, BigInt(rawAmount)],
})

const body = JSON.stringify({
  to: TOKEN_ADDRESS,
  data,
  gasLimit: GAS_LIMIT,
})

console.log("Trigger URL:", triggerUrl)
console.log("To (contract):", TOKEN_ADDRESS)
console.log("Recipient:", recipient)
console.log("Amount (wei):", rawAmount)
console.log("Calldata:", data)
console.log()
console.log("POSTing to trigger...")

const response = await fetch(triggerUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
})

const text = await response.text()
console.log(`Status: ${response.status}`)
console.log("Response:", text)
