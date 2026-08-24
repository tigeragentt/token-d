import {
  CronCapability,
  EVMClient,
  HTTPClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  bytesToBase64,
  bytesToHex,
  consensusIdenticalAggregation,
  encodeCallMsg,
  getNetwork,
  handler,
  json,
  ok,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  type Address,
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
} from "viem"
import { z } from "zod"

export type Config = {
  schedule: string
  sepoliaTokenAddress: string
  xdcTokenAddress: string
  xdcRpcUrl: string
}

const erc20Abi = parseAbi([
  "function totalSupply() external view returns (uint256)",
])

const xdcRpcSchema = z.object({
  result: z.string(),
})

const readSepoliaSupply = (runtime: Runtime<Config>): bigint => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: "ethereum-testnet-sepolia",
  })
  if (!network) throw new Error("Unknown chain: ethereum-testnet-sepolia")

  const evmClient = new EVMClient(network.chainSelector.selector)
  const callData = encodeFunctionData({ abi: erc20Abi, functionName: "totalSupply" })

  const result = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: runtime.config.sepoliaTokenAddress as Address,
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()

  const [supply] = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "totalSupply",
    data: bytesToHex(result.data),
  })
  return supply
}

// XDC Apothem is not natively supported by CRE EVM capability,
// so we use its public JSON-RPC endpoint via the HTTP capability.
const fetchXdcSupplyViaRpc = (
  sendRequester: HTTPSendRequester,
  tokenAddress: string,
  rpcUrl: string,
): string => {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: tokenAddress, data: "0x18160ddd" }, "latest"],
    id: 1,
  })

  const response = sendRequester
    .sendRequest({
      url: rpcUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(new TextEncoder().encode(payload)),
    })
    .result()

  if (!ok(response)) throw new Error(`XDC RPC error: HTTP ${response.statusCode}`)
  return xdcRpcSchema.parse(json(response)).result
}

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const sepoliaSupply = readSepoliaSupply(runtime)

  const httpClient = new HTTPClient()
  const xdcHex = httpClient
    .sendRequest(runtime, fetchXdcSupplyViaRpc, consensusIdenticalAggregation<string>())(
      runtime.config.xdcTokenAddress,
      runtime.config.xdcRpcUrl,
    )
    .result()

  const xdcSupply = BigInt(xdcHex)
  const total = sepoliaSupply + xdcSupply

  const bpSepolia = total > 0n ? (sepoliaSupply * 10000n) / total : 0n
  const bpXdc = total > 0n ? (xdcSupply * 10000n) / total : 0n

  const result = {
    sepoliaSupply: sepoliaSupply.toString(),
    xdcSupply: xdcSupply.toString(),
    totalSupply: total.toString(),
    distribution: {
      "ethereum-sepolia": `${(Number(bpSepolia) / 100).toFixed(2)}%`,
      "xdc-apothem": `${(Number(bpXdc) / 100).toFixed(2)}%`,
    },
  }

  runtime.log(`Token distribution: ${JSON.stringify(result)}`)
  return JSON.stringify(result)
}

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}
