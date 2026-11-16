import type { ChannelRow, CoverageRow, Outcome, OutcomeRow, TotalsRow, TouchRow } from './attribution.ts';
import { addDays } from './format.ts';

/** Sample rows for the attribution page: one fictional company, seeded so every load matches. Day 0 is the last day of the period. */

const G = 0, M = 1, L = 2, O = 3, E = 4, S = 5, D = 6;
const CHANNELS = [
  { key: 'paid_search_google', daily: 95 },
  { key: 'paid_social_meta', daily: 60 },
  { key: 'paid_social_linkedin', daily: 110 },
  { key: 'organic_search', daily: 0 },
  { key: 'email', daily: 0 },
  { key: 'outbound_email_phone', daily: 0 },
  { key: 'direct', daily: 0 },
];
const MODELS = ['first', 'last', 'lnd', 'linear'] as const;
type Model = (typeof MODELS)[number];

interface Touch { d: number; c: number; ch: number; what: string; matched: boolean }
interface Engagement { d: number; impressions: number; clicks: number }
interface Contact { name: string; role: string; matched: boolean }
interface Deal { created: number; close: number; status: 'open' | 'won' | 'lost'; amount: number }
interface Account { id: number; name: string; contacts: Contact[]; touches: Touch[]; lead: number; leadTouch: Touch; deal: Deal | null; declared: string | null; engagement: Engagement[] }
interface Item { account: Account; value: number; cut: number }

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = seeded(20261116);
const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
const pick = <T>(list: T[]): T => list[Math.floor(R() * list.length)];

const SURNAMES = ['Kessler', 'Brandt', 'Nordhaus', 'Lindqvist', 'Aalto', 'Vermeer', 'Hartmann', 'Sommer', 'Falk', 'Jansen', 'Riedel', 'Oster', 'Mahler', 'Thiele', 'Berger', 'Wolff', 'Dietz', 'Krause', 'Albers', 'Reinke', 'Holm', 'Stromberg', 'Engel', 'Voss'];
const SUFFIXES = ['Klimatechnik', 'Gebäudetechnik', 'Kälte & Klima', 'HVAC Services', 'Haustechnik', 'Mechanical', 'Facility Services'];
const FIRST_NAMES = ['Anna', 'Jonas', 'Marta', 'Felix', 'Lena', 'Tobias', 'Sara', 'Henrik', 'Mia', 'Paul', 'Eva', 'Nils', 'Clara', 'Oskar', 'Ida', 'Ben'];
const ROLES = ['Operations lead', 'Service manager', 'Managing director', 'Head of dispatch', 'IT manager', 'Finance lead'];
const DECLARED = ['Google search', 'A colleague', 'LinkedIn', 'Facebook or Instagram', 'Your sales team', 'Not sure'];

const usedNames = new Set<string>();
function accountName(): string {
  for (let i = 0; i < 50; i++) {
    const name = `${pick(SURNAMES)} ${pick(SUFFIXES)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  return `${pick(SURNAMES)} ${pick(SUFFIXES)}`;
}
const person = () => `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;

let linkedinCompanies = 0;
let linkedinMatched = 0;

function buildAccounts(): Account[] {
  const accounts: Account[] = [];
  for (let id = 0; id < 330; id++) {
    const r = R();
    const type = r < 0.27 ? 'meta' : r < 0.52 ? 'google' : r < 0.71 ? 'organic' : r < 0.84 ? 'committee' : r < 0.93 ? 'outbound' : 'linkedin';
    const lead = ri(-215, 0);
    const touches: Omit<Touch, 'matched'>[] = [];
    const contacts: Contact[] = [{ name: person(), role: pick(ROLES), matched: true }];
    const add = (d: number, c: number, ch: number, what: string) => touches.push({ d, c, ch, what });
    let leadCh: number, pDeal: number, lo: number, hi: number, pEngagement: number;

    if (type === 'meta') [leadCh, pDeal, lo, hi, pEngagement] = [M, 0.12, 6, 13, 0.05];
    else if (type === 'linkedin') [leadCh, pDeal, lo, hi, pEngagement] = [L, 0.3, 20, 50, 1];
    else if (type === 'google') {
      add(lead - ri(8, 26), 0, G, 'Clicked a Google ad');
      if (R() < 0.6) add(lead - ri(3, 7), 0, O, 'Read a guide from search');
      if (R() < 0.5) add(lead - ri(1, 2), 0, D, 'Visited pricing directly');
      [leadCh, pDeal, lo, hi, pEngagement] = [R() < 0.8 ? G : D, 0.42, 12, 32, 0.15];
    } else if (type === 'organic') {
      add(lead - ri(20, 45), 0, O, 'Read a blog post from search');
      add(lead - ri(9, 18), 0, O, 'Read a comparison page from search');
      if (R() < 0.6) add(lead - ri(3, 8), 0, E, 'Opened the newsletter');
      [leadCh, pDeal, lo, hi, pEngagement] = [R() < 0.45 ? O : D, 0.36, 10, 28, 0.15];
    } else if (type === 'committee') {
      add(lead - ri(25, 50), 0, O, 'Read a guide from search');
      if (R() < 0.5) add(lead - ri(4, 10), 0, E, 'Clicked a nurture email');
      [leadCh, pDeal, lo, hi, pEngagement] = [R() < 0.45 ? D : O, 0.56, 30, 82, 0.85];
    } else {
      add(lead - ri(10, 24), 0, S, 'Replied to an outbound message');
      if (R() < 0.6) add(lead - ri(3, 8), 0, E, 'Clicked a follow-up email');
      [leadCh, pDeal, lo, hi, pEngagement] = [S, 0.45, 14, 40, 0.15];
    }

    const leadWhat = leadCh === M ? 'Submitted a Meta lead form' : leadCh === L ? 'Submitted a LinkedIn lead form' : leadCh === S ? 'Booked a call with sales' : 'Submitted the demo form';
    add(lead, 0, leadCh, leadWhat);
    const leadTouch = touches[touches.length - 1];
    if ((type === 'meta' || type === 'linkedin') && R() < 0.5) add(lead + ri(2, 6), 0, E, 'Clicked a nurture email');

    const engagement: Engagement[] = [];
    if (R() < pEngagement) {
      linkedinCompanies++;
      if (R() < 0.75) {
        linkedinMatched++;
        for (let d = lead - ri(20, 60); d <= Math.min(0, lead + 30); d += 7) engagement.push({ d, impressions: ri(8, 60), clicks: R() < 0.35 ? ri(1, 3) : 0 });
      }
    }

    let deal: Deal | null = null;
    let declared: string | null = null;
    if (R() < pDeal) {
      const created = lead + ri(3, 12);
      if (created <= 0) {
        add(lead + ri(1, 2), 0, S, 'Call with an SDR');
        if (R() < 0.5) add(created - 1, 0, E, 'Clicked the demo reminder');
        add(created, 0, R() < 0.6 ? S : D, 'Demo held, deal created');
        const close = created + ri(18, 50);
        let status: Deal['status'] = 'open';
        if (R() < 0.5) add(created + ri(4, 14), 0, D, 'Visited pricing directly');
        if (R() < 0.4) add(created + ri(6, 16), 0, E, 'Opened the proposal email');
        if (close <= 0) {
          status = R() < 0.34 ? 'won' : 'lost';
          if (status === 'won') add(close - ri(1, 4), 0, S, 'Contract call');
        }
        deal = { created, close, status, amount: ri(lo, hi) * 1000 };
        const colleagues = type === 'committee' ? ri(1, 2) : R() < 0.35 ? 1 : 0;
        for (let k = 1; k <= colleagues; k++) {
          contacts.push({ name: person(), role: pick(ROLES), matched: R() > 0.1 });
          if (type === 'committee' && R() < 0.4) add(lead - ri(3, 20), k, O, 'Read a guide from search');
          if (R() < 0.7) {
            const pricing = R() < 0.5;
            add(lead + ri(1, created - lead), k, pricing ? D : O, pricing ? 'Visited pricing directly' : 'Read the security page from search');
          }
          if (R() < 0.6) add(created + ri(1, 12), k, E, 'Clicked the proposal email');
          if (R() < 0.4) add(created + ri(2, 15), k, D, 'Visited the integrations page directly');
        }
        declared = R() < 0.55 ? (leadCh === M ? 'Facebook or Instagram' : leadCh === L ? 'LinkedIn' : leadCh === S ? 'Your sales team' : type === 'committee' ? 'A colleague' : 'Google search') : pick(DECLARED);
      }
    }

    const all = touches.map((t) => ({ ...t, matched: contacts[t.c].matched }));
    const lt = all[touches.indexOf(leadTouch)];
    accounts.push({ id, name: accountName(), contacts, touches: all.filter((t) => t.d <= 0).sort((a, b) => a.d - b.d || a.c - b.c), lead, leadTouch: lt, deal, declared, engagement });
  }
  return accounts;
}

const ACCOUNTS = buildAccounts();
const SPEND = CHANNELS.map((ch) => {
  const byDay = new Map<number, number>();
  if (ch.daily) for (let d = -200; d <= 0; d++) byDay.set(d, ch.daily * (0.75 + R() * 0.5));
  return byDay;
});

function items(from: number, to: number, outcome: Outcome): Item[] {
  const inRange = (d: number) => d > from && d <= to;
  const out: Item[] = [];
  for (const account of ACCOUNTS) {
    if (outcome === 'leads') {
      if (inRange(account.lead)) out.push({ account, value: 1, cut: account.lead });
    } else if (!account.deal) continue;
    else if (outcome === 'pipeline') {
      if (inRange(account.deal.created)) out.push({ account, value: account.deal.amount, cut: account.deal.created });
    } else if (account.deal.status === 'won' && inRange(account.deal.close)) out.push({ account, value: account.deal.amount, cut: account.deal.close });
  }
  return out;
}

const eligible = (item: Item, scope: 'contact' | 'account') => item.account.touches.filter((t) => t.d <= item.cut && t.matched && (scope === 'account' || t.c === 0));
const hasEngagement = (item: Item) => item.account.engagement.some((e) => e.d <= item.cut && e.d >= item.cut - 90);

function credit(item: Item, model: Model): Map<Touch, number> {
  const path = eligible(item, 'account');
  const out = new Map<Touch, number>();
  if (path.length === 0) return out;
  if (model === 'first') out.set(path[0], item.value);
  else if (model === 'last') out.set(path[path.length - 1], item.value);
  else if (model === 'lnd') out.set(path.findLast((t) => t.ch !== D) ?? path[path.length - 1], item.value);
  else for (const t of path) out.set(t, item.value / path.length);
  return out;
}

function influenced(item: Item, scope: 'contact' | 'account'): Set<number> {
  const channels = new Set(eligible(item, scope).map((t) => t.ch));
  if (scope === 'account' && hasEngagement(item)) channels.add(L);
  return channels;
}

function spendBetween(from: number, to: number): (number | null)[] {
  return CHANNELS.map((ch, i) => {
    if (!ch.daily) return null;
    let total = 0;
    for (let d = from + 1; d <= to; d++) total += SPEND[i].get(d) ?? 0;
    return total;
  });
}

const sum = (values: (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);

export function mockAttribution(period: { end: string; days: string[] }, outcome: Outcome) {
  const length = period.days.length;
  const day = (d: number) => addDays(period.end, d);
  const current = items(-length, 0, outcome);
  const previous = items(-2 * length, -length, outcome);
  const spend = spendBetween(-length, 0);

  const channels: ChannelRow[] = CHANNELS.map((ch, i) => {
    const row: ChannelRow = {
      channel: ch.key,
      spend: spend[i],
      sourced: 0,
      influenced_contact: 0,
      influenced_account: 0,
      credit_first_touch: 0,
      credit_last_touch: 0,
      credit_last_non_direct: 0,
      credit_linear: 0,
      colleague_touches: 0,
      outcomes_with_colleague_touches: 0,
      outcomes_with_company_engagement: 0,
    };
    for (const item of current) {
      if (item.account.leadTouch.ch === i) row.sourced += item.value;
      if (influenced(item, 'contact').has(i)) row.influenced_contact += item.value;
      if (influenced(item, 'account').has(i)) row.influenced_account += item.value;
      const byModel = (model: Model) => [...credit(item, model)].reduce((total, [t, v]) => total + (t.ch === i ? v : 0), 0);
      row.credit_first_touch += byModel('first');
      row.credit_last_touch += byModel('last');
      row.credit_last_non_direct += byModel('lnd');
      row.credit_linear += byModel('linear');
      const colleague = eligible(item, 'account').filter((t) => t.c > 0 && t.ch === i).length;
      row.colleague_touches += colleague;
      if (colleague) row.outcomes_with_colleague_touches++;
      if (i === L && hasEngagement(item)) row.outcomes_with_company_engagement++;
    }
    return row;
  });

  const totals: TotalsRow[] = [
    { period: 'current', spend: sum(spend), outcome_value: sum(current.map((i) => i.value)), outcome_count: current.length },
    { period: 'previous', spend: sum(spendBetween(-2 * length, -length)), outcome_value: sum(previous.map((i) => i.value)), outcome_count: previous.length },
  ];

  const outcomes: OutcomeRow[] = current.map((item) => {
    const { account } = item;
    return {
      outcome_id: String(account.id),
      account_name: account.name,
      outcome_date: day(item.cut),
      value: item.value,
      status: account.deal ? account.deal.status : 'lead',
      lead_date: day(account.lead),
      deal_created_date: account.deal ? day(account.deal.created) : null,
      closed_date: account.deal && account.deal.status !== 'open' ? day(account.deal.close) : null,
      declared_source: account.declared,
      influenced_channels: [...influenced(item, 'account')].map((i) => CHANNELS[i].key),
      has_company_engagement: hasEngagement(item),
    };
  });

  const touches: TouchRow[] = current.flatMap((item) => {
    const { account } = item;
    const path = eligible(item, 'account');
    const byModel = Object.fromEntries(MODELS.map((model) => [model, credit(item, model)])) as Record<Model, Map<Touch, number>>;
    const none = { credit_first_touch: 0, credit_last_touch: 0, credit_last_non_direct: 0, credit_linear: 0 };
    const people: TouchRow[] = account.touches.map((t) => ({
      outcome_id: String(account.id),
      kind: 'touch',
      occurred_on: day(t.d),
      channel: CHANNELS[t.ch].key,
      label: t.what,
      contact_name: account.contacts[t.c].name,
      contact_role: account.contacts[t.c].role,
      is_lead_contact: t.c === 0,
      is_counted: path.includes(t),
      impressions: null,
      clicks: null,
      credit_first_touch: byModel.first.get(t) ?? 0,
      credit_last_touch: byModel.last.get(t) ?? 0,
      credit_last_non_direct: byModel.lnd.get(t) ?? 0,
      credit_linear: byModel.linear.get(t) ?? 0,
    }));
    const company: TouchRow[] = account.engagement.map((e) => ({
      outcome_id: String(account.id),
      kind: 'company_engagement',
      occurred_on: day(e.d),
      channel: CHANNELS[L].key,
      label: 'LinkedIn ad engagement',
      contact_name: null,
      contact_role: null,
      is_lead_contact: false,
      is_counted: e.d <= item.cut && e.d >= item.cut - 90,
      impressions: e.impressions,
      clicks: e.clicks,
      ...none,
    }));
    return [...company, ...people];
  });

  const contacts = current.flatMap((item) => item.account.contacts);
  const untracked = current.filter((item) => !eligible(item, 'account').some((t) => t.ch !== D));
  const coverage: CoverageRow = {
    outcomes: current.length,
    outcomes_with_tracked_touch: current.length - untracked.length,
    contacts: contacts.length,
    contacts_matched: contacts.filter((c) => c.matched).length,
    unattributed_value: sum(untracked.map((i) => i.value)),
    linkedin_companies: linkedinCompanies,
    linkedin_companies_matched: linkedinMatched,
  };

  return { channels, totals, outcomes, touches, coverage };
}
