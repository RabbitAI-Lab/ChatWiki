import type { PaymentProvider } from "./types";

const providers = new Map<string, PaymentProvider>();

export function registerProvider(provider: PaymentProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): PaymentProvider {
  const p = providers.get(name);
  if (!p) throw new Error(`Payment provider "${name}" not registered`);
  return p;
}

export function getAvailableProviders(): string[] {
  return [...providers.keys()];
}

export function isProviderAvailable(name: string): boolean {
  return providers.has(name);
}
