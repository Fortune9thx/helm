"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                className="rounded-full bg-cyan px-5 py-2.5 text-sm font-semibold text-void transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,240,255,0.45)]"
              >
                Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="rounded-full border border-rose/50 bg-rose-soft px-5 py-2.5 text-sm font-medium text-rose"
              >
                Wrong network
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text-primary transition-colors duration-200 hover:border-border-strong"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
