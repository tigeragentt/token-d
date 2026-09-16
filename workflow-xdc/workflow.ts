import {
  HTTPCapability,
  HTTPClient,
  bytesToBase64,
  ConsensusAggregationByFields,
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
import { privateKeyToAccount } from "viem/accounts"
import { keccak256 } from "viem"

export type Config = {
  xdcRpcUrl: string   // e.g. "https://rpc.apothem.network"
  xdcChainId: number  // 51 for XDC Apothem
}

type TriggerBody = {
  to: string       // target contract address
  data: string     // ABI-encoded calldata (hex)
  gasLimit?: number
}

// Node-mode: submit the already-signed tx to the XDC RPC.
// All DON nodes sign the same tx (same key + same nonce = same bytes),
// so the first submission succeeds and the rest get "already known" — handled gracefully.
const submitRawTx = (
  nodeRuntime: NodeRuntime<Config>,
  signedTx: string,
): { status: string } => {
  const httpClient = new HTTPClient()

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_sendRawTransaction",
    params: [signedTx],
    id: 1,
  })

  const response = httpClient
    .sendRequest(nodeRuntime, {
      url: nodeRuntime.config.xdcRpcUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(new TextEncoder().encode(body)),
      cacheSettings: { store: false },
    })
    .result()

  if (!ok(response)) throw new Error(`HTTP ${response.statusCode}`)

  const result = json(response) as { result?: string; error?: { message: string } }

  if (result.error) {
    const msg = result.error.message.toLowerCase()
    if (msg.includes("already known") || msg.includes("nonce too low")) {
      return { status: "already_known" }
    }
    throw new Error(`RPC error: ${result.error.message}`)
  }

  return { status: "submitted" }
}

// DON-mode helper: single JSON-RPC call with identical consensus across all nodes.
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

  const hexResult = httpClient.sendRequest(
    runtime,
    (sendRequester: HTTPSendRequester) => {
      const r = sendRequester.sendRequest({
        url: xdcRpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyBytes,
      }).result()
      if (!ok(r)) throw new Error(`${method} HTTP ${r.statusCode}`)
      return (json(r) as { result: string }).result
    },
    consensusIdenticalAggregation<string>()
  )().result()

  return hexResult
}

// HTTP trigger handler — receives { to, data, gasLimit? } and submits the tx to XDC.
export const onHttpTrigger = async (
  runtime: Runtime<Config>,
  triggerEvent: HTTPPayload,
): Promise<string> => {
  const httpClient = new HTTPClient()
  const { xdcChainId } = runtime.config

  const { to, data, gasLimit = 300000 } = JSON.parse(
    new TextDecoder().decode(triggerEvent.input)
  ) as TriggerBody

  const privateKey = runtime.getSecret({ id: "cre_transaction_private_key" }).result().value as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  runtime.log(`Sender: ${account.address}`)

  const nonceHex = rpcCall(runtime, httpClient, "eth_getTransactionCount", [account.address, "pending"], 1)
  const nonce = parseInt(nonceHex, 16)

  const gasPriceHex = rpcCall(runtime, httpClient, "eth_gasPrice", [], 2)
  const gasPrice = BigInt(gasPriceHex)

  runtime.log(`Nonce: ${nonce}, gasPrice: ${gasPrice}`)

  const signedTx = await account.signTransaction({
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    nonce,
    gasPrice,
    gas: BigInt(gasLimit),
    chainId: xdcChainId,
    type: "legacy",
  })

  const txHash = keccak256(signedTx)

  runtime.log(`TxHash: ${txHash}`)

  runtime.runInNodeMode(
    submitRawTx,
    ConsensusAggregationByFields<{ status: string }>({ status: identical })
  )(signedTx).result()

  return JSON.stringify({ txHash, to, nonce, status: "submitted" })
}

export const initWorkflow = (config: unknown) => {
  const http = new HTTPCapability()
  return [handler(http.trigger({ authorizedKeys: [] }), onHttpTrigger)]
}
