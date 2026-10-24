export const money = (value: number | string, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value))

export const time = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export const shortId = (value: string) => `${value.slice(0, 8)}…${value.slice(-4)}`
