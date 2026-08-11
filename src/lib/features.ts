// Feature flags. Jedno místo, kde se modul zapíná a vypíná.
//
// payments: celý platební modul (Platby v menu, předpisy, QR platba,
// upomínky, párování z banky, finance ve Správě domu, platební nastavení).
// Zatím vypnuto — v UI se místo obsahu ukazuje zámek "Připravujeme".
// Zapnutí = přepnout na true, nic dalšího mazat netřeba.
export const FEATURES = {
  payments: false,
} as const

export const paymentsEnabled: boolean = FEATURES.payments
