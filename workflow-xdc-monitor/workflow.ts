import {
  CronCapability,
  HTTPCapability,
  HTTPClient,
  bytesToBase64,
  consensusIdenticalAggregation,
  handler,
  json,
  ok,
  type HTTPPayload,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk"

export type Config = {
  xdcRpcUrl: string     // e.g. "https://rpc.apothem.network"
  tokenAddress: string  // XDC token contract to monitor
  lookbackBlocks: number // blocks to look back on each tick (default: 60 ≈ 2 min on Apothem)
  schedule: string      // cron expression, e.g. "0 */1 * * * *"
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

type LogEntry = {
  topics: string[]
  data: string
  transactionHash: string
  blockNumber: string
}

// Generic RPC call — returns the raw `result` field as a JSON string (works for any response type).
const rpcCall = (
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  method: string,
  params: unknown[],
  id: number,
): string => {
  const { xdcRpcUrl } = runtime.config
  const bodyBytes = bytesToBase64(
    new TextEncoder().encode(JSON.stringify({ jsonrpc: "2.0", method, params, id }))
  )

  return httpClient.sendRequest(
    runtime,
    (sendRequester: HTTPSendRequester) => {
      const r = sendRequester.sendRequest({
        url: xdcRpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyBytes,
      }).result()
      if (!ok(r)) throw new Error(`${method} HTTP error`)
      const resp = json(r) as { result: unknown; error?: { message: string } }
      if (resp.error) throw new Error(`RPC error: ${resp.error.message}`)
      // Serialize to string for deterministic consensus comparison across DON nodes.
      return JSON.stringify(resp.result)
    },
    consensusIdenticalAggregation<string>()
  )().result()
}

type ScanResult = {
  events: number
  fromBlock: string
  currentBlock: number
  transfers?: Array<{ from: string; to: string; amount: string; txHash: string; block: number }>
}

const scanTransfers = (runtime: Runtime<Config>, lookbackOverride?: number): ScanResult => {
  const { tokenAddress, lookbackBlocks } = runtime.config
  const httpClient = new HTTPClient()
  const lookback = lookbackOverride ?? lookbackBlocks

  const blockHex = JSON.parse(rpcCall(runtime, httpClient, "eth_blockNumber", [], 1)) as string
  const currentBlock = parseInt(blockHex, 16)
  const fromBlock = "0x" + Math.max(0, currentBlock - lookback).toString(16)

  runtime.log(`Polling Transfer events — blocks ${fromBlock} → latest (current: ${currentBlock})`)

  const logsRaw = rpcCall(runtime, httpClient, "eth_getLogs", [{
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

  const transfers = logs.map(log => {
    const from = "0x" + log.topics[1].slice(26)
    const to   = "0x" + log.topics[2].slice(26)
    const amount = BigInt(log.data)
    runtime.log(`Transfer: ${from} → ${to}  amount=${amount.toString()} (raw)`)
    return { from, to, amount: amount.toString(), txHash: log.transactionHash, block: parseInt(log.blockNumber, 16) }
  })

  return { events: transfers.length, fromBlock, currentBlock, transfers }
}

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  return JSON.stringify(scanTransfers(runtime))
}

export const onHttpTrigger = (runtime: Runtime<Config>, triggerEvent: HTTPPayload): string => {
  let lookbackOverride: number | undefined
  try {
    const body = JSON.parse(new TextDecoder().decode(triggerEvent.input)) as { lookbackBlocks?: number }
    if (body.lookbackBlocks) lookbackOverride = body.lookbackBlocks
  } catch {}
  return JSON.stringify(scanTransfers(runtime, lookbackOverride))
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
