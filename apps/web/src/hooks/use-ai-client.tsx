import { createContext, type ReactNode, useContext } from "react"
import { type AiClient, unconfiguredAiClient } from "../lib/ai-client"

const AiClientContext = createContext<AiClient>(unconfiguredAiClient)

export function AiClientProvider({
	client = unconfiguredAiClient,
	children,
}: {
	client?: AiClient
	children: ReactNode
}) {
	return (
		<AiClientContext.Provider value={client}>
			{children}
		</AiClientContext.Provider>
	)
}

export function useAiClient(): AiClient {
	return useContext(AiClientContext)
}
