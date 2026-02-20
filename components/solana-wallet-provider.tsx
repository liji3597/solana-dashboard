"use client";

import { useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

// Default styles for the wallet modal
import "@solana/wallet-adapter-react-ui/styles.css";

interface SolanaWalletProviderProps {
    children: React.ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
    // Use Helius RPC if available, otherwise public mainnet
    const endpoint = useMemo(() => {
        const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        if (heliusKey) {
            return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
        }
        return "https://api.mainnet-beta.solana.com";
    }, []);

    const wallets = useMemo(
        () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
        [],
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
