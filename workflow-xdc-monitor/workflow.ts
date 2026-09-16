import {
  CronCapability,
  ConsensusAggregationByFields,
  HTTPCapability,
  HTTPClient,
  bytesToBase64,
  consensusIdenticalAggregation,
  identical,
  handler,
  json,
  ok,
  type HTTPPayload,
  type HTTPSendRequester,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import { encodeFunctionData } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { keccak256 } from "viem"

export type Config = {
  xdcRpcUrl: string      // e.g. "https://rpc.apothem.network"
  tokenAddress: string   // XDC token contract to monitor
  lookbackBlocks: number // blocks to look back on each tick (default: 60 ≈ 2 min on Apothem)
  schedule: string       // cron expression, e.g. "0 */1 * * * *"
  networkName: string    // label for Observer reports, e.g. "XDC"
  // Observer reporting (Ethereum Sepolia) — set observerAddress to "" to disable
  sepoliaRpcUrl: string
  observerAddress: string
  sepoliaChainId: number
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// ActionType enum values mirror Observer.sol: Transfer=0, Mint=1, Burn=2, …
const ACTION_TRANSFER = 0

const OBSERVER_ABI = [
  {
    name: "reportAction",
    type: "function",
    inputs: [
      { name: "network", type: "string" },
      { name: "action",  type: "uint8"  },
      { name: "from",    type: "string" },
      { name: "to",      type: "string" },
      { name: "amount",  type: "uint256"},
      { name: "txHash",  type: "string" },
    ],
    outputs: [{ name: "reportId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const

type LogEntry = {
  topics: string[]
  data: string
  transactionHash: string
  blockNumber: string
}

type Transfer = {
  from: string
  to: string
  amount: string
  txHash: string
  block: number
}

type ScanResult = {
  events: number
  fromBlock: string
  currentBlock: number
  transfers?: Transfer[]
}

// ─── RPC helpers ─────────────────────────────────────────────────────────────

const rpcCall = (
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  rpcUrl: string,
  method: string,
  params: unknown[],
  id: number,
): string => {
  const bodyBytes = bytesToBase64(
    new TextEncoder().encode(JSON.stringify({ jsonrpc: "2.0", method, params, id }))
  )

  return httpClient.sendRequest(
    runtime,
    (sendRequester: HTTPSendRequester) => {
      const r = sendRequester.sendRequest({
        url: rpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyBytes,
      }).result()
      if (!ok(r)) throw new Error(`${method} HTTP error`)
      const resp = json(r) as { result: unknown; error?: { message: string } }
      if (resp.error) throw new Error(`RPC error: ${resp.error.message}`)
      return JSON.stringify(resp.result)
    },
    consensusIdenticalAggregation<string>()
  )().result()
}

// ─── Node-mode: submit a signed tx ───────────────────────────────────────────

const submitTx = (
  nodeRuntime: NodeRuntime<Config>,
  signedTx: string,
): { status: string } => {
  const httpClient = new HTTPClient()
  const { sepoliaRpcUrl } = nodeRuntime.config
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_sendRawTransaction",
    params: [signedTx],
    id: 1,
  })
  const response = httpClient.sendRequest(nodeRuntime, {
    url: sepoliaRpcUrl,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bytesToBase64(new TextEncoder().encode(body)),
    cacheSettings: { store: false },
  }).result()
  if (!ok(response)) throw new Error(`HTTP ${response.statusCode}`)
  const result = json(response) as { result?: string; error?: { message: string } }
  if (result.error) {
    const msg = result.error.message.toLowerCase()
    if (msg.includes("already known") || msg.includes("nonce too low") || msg.includes("replacement")) {
      return { status: "already_known" }
    }
    throw new Error(`RPC error: ${result.error.message}`)
  }
  return { status: "submitted" }
}

// ─── XDC scan ────────────────────────────────────────────────────────────────

const scanTransfers = (runtime: Runtime<Config>, lookbackOverride?: number): ScanResult => {
  const { xdcRpcUrl, tokenAddress, lookbackBlocks } = runtime.config
  const httpClient = new HTTPClient()
  const lookback = lookbackOverride ?? lookbackBlocks

  const blockHex = JSON.parse(rpcCall(runtime, httpClient, xdcRpcUrl, "eth_blockNumber", [], 1)) as string
  const currentBlock = parseInt(blockHex, 16)
  const fromBlock = "0x" + Math.max(0, currentBlock - lookback).toString(16)

  runtime.log(`Polling Transfer events — blocks ${fromBlock} → latest (current: ${currentBlock})`)

  const logsRaw = rpcCall(runtime, httpClient, xdcRpcUrl, "eth_getLogs", [{
    fromBlock,
    toBlock: "latest",
    address: tokenAddress,
    topics: [TRANSFER_TOPIC],
  }], 2)

  const logs = JSON.parse(logsRaw) as LogEntry[]

  if (logs.length === 0) {
    runtime.log("No Transfer events in this window")
    return { events: 0, fromBlock, currentBlock }
  }

  runtime.log(`Found ${logs.length} Transfer event(s)`)

  const transfers: Transfer[] = logs.map(log => {
    const from   = "0x" + log.topics[1].slice(26)
    const to     = "0x" + log.topics[2].slice(26)
    const amount = BigInt(log.data)
    runtime.log(`Transfer: ${from} → ${to}  amount=${amount.toString()} (raw)`)
    return { from, to, amount: amount.toString(), txHash: log.transactionHash, block: parseInt(log.blockNumber, 16) }
  })

  return { events: transfers.length, fromBlock, currentBlock, transfers }
}

// ─── Sepolia Observer reporting ───────────────────────────────────────────────

const reportToObserver = async (
  runtime: Runtime<Config>,
  transfers: Transfer[],
): Promise<void> => {
  const { sepoliaRpcUrl, observerAddress, sepoliaChainId, networkName } = runtime.config
  if (!observerAddress) return

  const httpClient = new HTTPClient()
  const privateKey = runtime.getSecret({ id: "cre_transaction_private_key" }).result().value as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  runtime.log(`Reporting ${transfers.length} event(s) to Observer — sender: ${account.address}`)

  const nonceHex = JSON.parse(rpcCall(runtime, httpClient, sepoliaRpcUrl, "eth_getTransactionCount", [account.address, "pending"], 10))
  let nonce = parseInt(nonceHex as string, 16)

  const gasPriceHex = JSON.parse(rpcCall(runtime, httpClient, sepoliaRpcUrl, "eth_gasPrice", [], 11))
  const gasPrice = BigInt(gasPriceHex as string)

  for (const transfer of transfers) {
    const data = encodeFunctionData({
      abi: OBSERVER_ABI,
      functionName: "reportAction",
      args: [networkName, ACTION_TRANSFER, transfer.from, transfer.to, BigInt(transfer.amount), transfer.txHash],
    })

    const signedTx = await account.signTransaction({
      to: observerAddress as `0x${string}`,
      data,
      nonce,
      gasPrice,
      gas: 200000n,
      chainId: sepoliaChainId,
      type: "legacy",
    })

    const txHash = keccak256(signedTx)
    runtime.log(`Observer report — nonce ${nonce}, txHash: ${txHash}`)

    runtime.runInNodeMode(
      submitTx,
      ConsensusAggregationByFields<{ status: string }>({ status: identical })
    )(signedTx).result()

    nonce++
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const onCronTrigger = async (runtime: Runtime<Config>): Promise<string> => {
  const result = scanTransfers(runtime)
  if (result.transfers && result.transfers.length > 0) {
    await reportToObserver(runtime, result.transfers)
  }
  return JSON.stringify(result)
}

export const onHttpTrigger = async (runtime: Runtime<Config>, triggerEvent: HTTPPayload): Promise<string> => {
  let lookbackOverride: number | undefined
  try {
    const body = JSON.parse(new TextDecoder().decode(triggerEvent.input)) as { lookbackBlocks?: number }
    if (body.lookbackBlocks) lookbackOverride = body.lookbackBlocks
  } catch {}
  const result = scanTransfers(runtime, lookbackOverride)
  if (result.transfers && result.transfers.length > 0) {
    await reportToObserver(runtime, result.transfers)
  }
  return JSON.stringify(result)
}

export const initWorkflow = (config: unknown) => {
  const cron = new CronCapability()
  const http = new HTTPCapability()
  const cfg = config as Config
  return [
    handler(cron.trigger({ schedule: cfg.schedule }), onCronTrigger),
    handler(http.trigger({ authorizedKeys: [] }), onHttpTrigger),
  ]
}
