export type Payment = {
  id: number;
  date: string;
  vendor: string;
  category: string;
  amount: number;
};

export type ActionItem = {
  id: number;
  title: string;
  detail: string;
  amount?: number;
  tone: "mint" | "blue" | "orange";
};

export type ChecklistItem = {
  id: number | string;
  title: string;
  meta?: string;
  done: boolean;
};

export const payments: Payment[] = [
  { id: 1, date: "23. maj", vendor: "Norlys", category: "Internet", amount: 499 },
  { id: 2, date: "24. maj", vendor: "Aconto varme", category: "Aalborg Forsyning", amount: 650 },
  { id: 3, date: "28. maj", vendor: "YouSee", category: "TV & streaming", amount: 399 },
  { id: 4, date: "31. maj", vendor: "Skolepenge", category: "Emil", amount: 1200 },
];

export const initialActions: ActionItem[] = [
  { id: 1, title: "Refusion fra Gjensidige", detail: "Indsendt 19. maj", amount: 1250, tone: "mint" },
  { id: 2, title: "Kreditnota · Elgiganten", detail: "Indsendt 18. maj", amount: -349, tone: "blue" },
  { id: 3, title: "Forsikring · Police", detail: "Udløber 1. juli", tone: "orange" },
];

export const documents = [
  ["Faktura · Norlys", "Internet · Forfalder 23. maj", "499 kr."],
  ["Kvittering · Rema 1000", "19. maj 2025", "236,75 kr."],
  ["Forsikring · Police", "Gjensidige · Udløber 1. juli", ""],
  ["Lønseddel · Anders", "Maj 2025", ""],
];

export const initialTasks: ChecklistItem[] = [
  { id: 1, title: "Rengøring af badeværelse", meta: "Lørdag · Anders", done: false },
  { id: 2, title: "Bestil nye kontaktlinser", meta: "18. maj · Sofie", done: true },
  { id: 3, title: "Book tandlægetid til Emil", meta: "26. maj · Anders", done: false },
  { id: 4, title: "Klip hæk i baghaven", meta: "Denne uge · Anders", done: false },
];

export const initialShopping: ChecklistItem[] = [
  { id: 1, title: "Mælk", done: true },
  { id: 2, title: "Æg", done: false },
  { id: 3, title: "Pasta", done: false },
  { id: 4, title: "Tomater", done: true },
  { id: 5, title: "Kyllingebryst", done: false },
  { id: 6, title: "Toiletpapir", done: false },
];

export const meals = [
  ["Man 19/5", "Pastasalat med kylling", "20 min"],
  ["Tir 20/5", "Tærte med salat", "35 min"],
  ["Ons 21/5", "Boller i karry med ris", "30 min"],
  ["Tor 22/5", "Laks med grønt", "25 min"],
  ["Fre 23/5", "Taco-fredag", "30 min"],
  ["Lør 24/5", "Burger & fritter", "40 min"],
  ["Søn 25/5", "Tomatsuppe & brød", "25 min"],
];

export const calendarItems = [
  ["I dag · 20. maj", "08.30", "Tandlæge · Sofie", "blue"],
  ["I dag · 20. maj", "13.00", "Møde", "mint"],
  ["I dag · 20. maj", "17.30", "Fodboldtræning · Emil", "violet"],
  ["I morgen · 21. maj", "10.00", "Indkøb", "blue"],
  ["I morgen · 21. maj", "16.00", "Yoga · Sofie", "violet"],
];
