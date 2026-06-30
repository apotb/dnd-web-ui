export const CURRENCY_COINS = ["cp", "sp", "ep", "gp", "pp"] as const;

export type CurrencyCoin = (typeof CURRENCY_COINS)[number];

export type CurrencyWallet = Record<CurrencyCoin, number>;

export type ApplyCurrencyDeltaResult =
  | { ok: true; currency: CurrencyWallet }
  | { ok: false };

function cloneWallet(wallet: CurrencyWallet): CurrencyWallet {
  return { ...wallet };
}

function splitOneStep(
  wallet: CurrencyWallet,
  from: CurrencyCoin,
  ultimateTarget: CurrencyCoin
): void {
  switch (from) {
    case "pp":
      wallet.gp += 10;
      break;
    case "gp":
      if (ultimateTarget === "ep") {
        wallet.ep += 2;
      } else {
        wallet.sp += 10;
      }
      break;
    case "ep":
      wallet.sp += 5;
      break;
    case "sp":
      wallet.cp += 10;
      break;
  }
}

function acquire(wallet: CurrencyWallet, coin: CurrencyCoin, amount: number): boolean {
  if (amount <= 0) return true;
  if (wallet[coin] >= amount) return true;

  const coinIdx = CURRENCY_COINS.indexOf(coin);

  while (wallet[coin] < amount) {
    let progressed = false;

    for (let i = coinIdx + 1; i < CURRENCY_COINS.length; i++) {
      const higher = CURRENCY_COINS[i]!;
      if (wallet[higher] > 0) {
        wallet[higher] -= 1;
        splitOneStep(wallet, higher, coin);
        progressed = true;
        break;
      }
    }

    if (progressed) continue;

    for (let i = coinIdx + 1; i < CURRENCY_COINS.length; i++) {
      const higher = CURRENCY_COINS[i]!;
      if (acquire(wallet, higher, 1)) {
        progressed = true;
        break;
      }
    }

    if (!progressed) break;
  }

  return wallet[coin] >= amount;
}

function withdraw(wallet: CurrencyWallet, coin: CurrencyCoin, amount: number): boolean {
  if (amount <= 0) return true;
  if (!acquire(wallet, coin, amount)) return false;
  wallet[coin] -= amount;
  return true;
}

export function applyCurrencyDelta(
  wallet: CurrencyWallet,
  coin: CurrencyCoin,
  delta: number
): ApplyCurrencyDeltaResult {
  if (delta === 0) return { ok: false };

  const next = cloneWallet(wallet);

  if (delta > 0) {
    next[coin] += delta;
    return { ok: true, currency: next };
  }

  if (!withdraw(next, coin, -delta)) {
    return { ok: false };
  }

  return { ok: true, currency: next };
}
