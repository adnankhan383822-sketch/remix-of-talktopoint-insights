import { maskMessages, parseConversation } from "@/lib/parser";
import type { Analysis, Conversation } from "@/lib/types";

const startupRaw = `[09:02] Maya: Morning! We need to lock pricing for the Oct 20 launch today.
[09:04] Leo: Waitlist survey is in: 62% said they'd pay $20–30/month. Competitors sit at $35–49.
[09:05] Dev: Whatever we pick, Stripe billing needs ~3 days of work. I need the final number by Friday.
[09:07] Priya: I'd keep a free tier. Onboarding converts way better when people can try it first.
[09:09] Maya: Agreed on a free tier, capped at 5 conversations per month.
[09:11] Leo: For Pro I propose $29/month flat. Undercuts everyone and matches the survey.
[09:12] Dev: Flat is also simplest to build. Per-seat would add a full week.
[09:14] Maya: Decision: Pro is $29/month flat, free tier capped at 5 conversations. Let's go.
[09:16] Priya: I'll update the pricing page mockups by Wednesday.
[09:18] Dev: I'll wire up Stripe checkout, targeting Friday Oct 9.
[09:20] Leo: Worried about launch traffic though — the last beta signup spike took the API down for 20 minutes.
[09:22] Dev: Fair. I'll add rate limiting and autoscaling before launch. Leo, can you draft the launch email?
[09:23] Leo: Yes, draft by Thursday Oct 8.
[09:25] Maya: Also: no Product Hunt launch this time, we focus on our newsletter partners.
[09:26] Priya: Makes sense. Should we offer an annual discount?
[09:28] Maya: Let's park annual pricing until after launch. Great work all 🚀`;

const meetingRaw = `[00:00:15] Sam: Thanks everyone. Agenda: pricing review, Q4 roadmap, and the mobile app question.
[00:01:02] Nina: I ran the unit economics. At $29 flat, AI costs eat 48% of revenue for heavy users.
[00:01:40] Dev: Heavy users upload long transcripts — each one costs us about 40 cents to process.
[00:02:18] Nina: My recommendation is $39 per seat per month for Pro.
[00:03:05] Maya: That reverses what we agreed last week, but the numbers are hard to argue with.
[00:03:30] Sam: Okay. Decision: Pro moves to $39 per seat per month. We keep the free tier.
[00:04:10] Dev: Per-seat billing means about one extra week of work. Launch slips to Oct 27.
[00:04:45] Maya: I can live with Oct 27. Better than launching with broken margins.
[00:06:20] Sam: Roadmap: Slack integration is top priority for Q4, then Zoom import.
[00:07:05] Dev: Slack is about two sprints. I'll write the tech spec by Oct 13.
[00:09:30] Sam: Mobile — I suggest we don't build a native app this year. Responsive web only.
[00:10:02] Maya: Agreed. No native app in 2026.
[00:11:15] Nina: I'll update the financial model with the new pricing by Oct 9.
[00:12:40] Sam: Maya, can you tell Leo and Priya about the pricing change? Their launch work depends on it.
[00:13:00] Maya: Yes, I'll message them today.
[00:14:05] Dev: One risk: Slack's API rate limits may block real-time sync, so we'll probably need batching.`;

const supportRaw = `10/10/26, 14:02 - Jordan Lee: Hi, I was charged twice for my Pro plan this month. Really frustrating.
10/10/26, 14:04 - Ana (Support): I'm so sorry about that, Jordan! Can you confirm the account email?
10/10/26, 14:05 - Jordan Lee: It's jordan.lee@acme.io. The card I used is 4242 4242 4242 4242 — oops, full number, my bad.
10/10/26, 14:07 - Ana (Support): No worries, please never share full card numbers here. I can see two charges of $39 on Oct 3.
10/10/26, 14:08 - Jordan Lee: Yes, that's it. Also, export to PDF keeps failing on large transcripts.
10/10/26, 14:10 - Ana (Support): I've issued a refund for the duplicate charge. It will appear in 5–7 business days.
10/10/26, 14:11 - Jordan Lee: Thanks. And the PDF issue?
10/10/26, 14:13 - Ana (Support): I reproduced it — transcripts over 500 messages time out. Escalated to engineering as bug #4821.
10/10/26, 14:14 - Jordan Lee: Any ETA? We need it for a board meeting next Thursday.
10/10/26, 14:16 - Ana (Support): Engineering is targeting a fix by Oct 14. Meanwhile, Copy as Markdown works as a workaround.
10/10/26, 14:18 - Jordan Lee: Okay. Please call me if it slips: +1 415 555 0134.
10/10/26, 14:19 - Ana (Support): Will do. I'll follow up by Oct 14 either way. Anything else?
10/10/26, 14:20 - Jordan Lee: That's all. Appreciate the fast help, much better than last time.`;

const startupAnalysis: Analysis = {
  title: "Launch pricing decision",
  tags: ["pricing", "launch", "billing"],
  summaries: {
    "tldr:executive":
      "Pro launches at $29/month flat with a free tier capped at 5 conversations [8]. Launch is Oct 20; billing, mockups and launch email are owned and dated [9,10,13].",
    "standard:executive":
      "The team locked launch pricing for the Oct 20 launch [1]. Survey data showed 62% of the waitlist would pay $20–30/month, below competitors at $35–49 [2]. Maya decided Pro will be $29/month flat, with a free tier capped at 5 conversations per month [8], chosen partly because flat pricing is a week faster to build than per-seat [7].\n\nOwners are set: Priya updates pricing mockups by Wednesday [9], Dev ships Stripe checkout by Oct 9 [10], and Leo drafts the launch email by Oct 8 [13]. The main risk is launch traffic after a previous 20-minute outage [11]; Dev will add rate limiting and autoscaling [12]. Product Hunt is skipped in favour of newsletter partners [14], and annual pricing is parked until after launch [16].",
    "detailed:executive":
      "**Context.** Maya opened the chat to finalize pricing ahead of the Oct 20 launch [1]. Dev needed a final number by Friday since Stripe billing takes about three days [3].\n\n**Evidence.** Leo shared waitlist survey results: 62% would pay $20–30/month, while competitors charge $35–49 [2]. Priya argued for a free tier because try-first onboarding converts better [4].\n\n**Decisions.**\n- Pro at $29/month flat [6,8]\n- Free tier capped at 5 conversations/month [5,8]\n- No Product Hunt launch; focus on newsletter partners [14]\n- Annual pricing parked until after launch [16]\n\n**Rationale.** Flat pricing undercuts competitors, matches survey willingness-to-pay, and avoids an extra week of per-seat engineering [6,7].\n\n**Risks.** A previous beta signup spike took the API down for 20 minutes [11]. Mitigation: rate limiting and autoscaling before launch [12].\n\n**Next steps.** Mockups (Priya, Wed) [9], Stripe checkout (Dev, Oct 9) [10], launch email draft (Leo, Oct 8) [13].",
    "standard:developer":
      "Engineering scope: implement flat $29/month Pro billing in Stripe — no per-seat logic, which saves about a week [7,8]. Checkout must be live by Oct 9 [10]. Enforce a free-tier limit of 5 conversations per month [5]. Before the Oct 20 launch, add rate limiting and autoscaling — a previous signup spike caused a 20-minute API outage [11,12].",
  },
  insights: [
    { type: "decision", text: "Pro plan priced at $29/month flat", importance: "high", confidence: 0.97, sources: [6, 8] },
    { type: "decision", text: "Free tier kept, capped at 5 conversations per month", importance: "high", confidence: 0.95, sources: [4, 5, 8] },
    { type: "risk", text: "Launch traffic may overload the API (previous 20-minute outage)", importance: "high", confidence: 0.9, sources: [11, 12] },
    { type: "key_point", text: "62% of waitlist would pay $20–30/month; competitors charge $35–49", importance: "medium", confidence: 0.96, sources: [2] },
    { type: "key_point", text: "Flat pricing is a week faster to build than per-seat", importance: "medium", confidence: 0.88, sources: [7] },
    { type: "decision", text: "No Product Hunt launch; focus on newsletter partners", importance: "medium", confidence: 0.93, sources: [14] },
    { type: "question", text: "Annual discount — parked until after launch", importance: "low", confidence: 0.86, sources: [15, 16] },
  ],
  actions: [
    { id: "s1-a1", task: "Wire up Stripe checkout for Pro plan", owner: "Dev", due: "2026-10-09", priority: "high", status: "in_progress", confidence: 0.96, sources: [3, 10] },
    { id: "s1-a2", task: "Add rate limiting and autoscaling before launch", owner: "Dev", due: "2026-10-19", priority: "high", status: "todo", confidence: 0.84, sources: [11, 12] },
    { id: "s1-a3", task: "Update pricing page mockups", owner: "Priya", due: "2026-10-07", priority: "medium", status: "done", confidence: 0.92, sources: [9] },
    { id: "s1-a4", task: "Draft the launch email", owner: "Leo", due: "2026-10-08", priority: "medium", status: "todo", confidence: 0.95, sources: [12, 13] },
  ],
};

const meetingAnalysis: Analysis = {
  title: "Product sync: pricing & Q4 roadmap",
  tags: ["pricing", "roadmap", "finance"],
  summaries: {
    "tldr:executive":
      "Pro pricing changes to $39/seat/month to protect margins, reversing last week's $29 flat decision [5,6]. Launch slips to Oct 27 [7,8]; Slack integration leads Q4 and no native app this year [9,12].",
    "standard:executive":
      "Nina's unit economics showed AI costs consuming 48% of revenue for heavy users at $29 flat [2,3], so the team changed Pro to $39 per seat per month while keeping the free tier [4,6]. Maya acknowledged this reverses last week's decision [5]. Per-seat billing adds a week, moving launch to Oct 27 [7,8].\n\nFor Q4, Slack integration is the top priority followed by Zoom import [9]; Dev writes the spec by Oct 13 [10]. There will be no native mobile app in 2026 [11,12]. Nina updates the financial model by Oct 9 [13] and Maya will inform Leo and Priya of the pricing change today [14,15]. Slack API rate limits are a known risk [16].",
    "detailed:executive":
      "**Agenda.** Pricing review, Q4 roadmap, mobile app [1].\n\n**Pricing.** At $29 flat, AI processing for heavy users consumes 48% of revenue [2], with long transcripts costing ~40 cents each [3]. Nina recommended $39 per seat per month [4]. Maya noted this reverses last week's decision [5]. **Decision:** Pro moves to $39/seat/month; free tier stays [6].\n\n**Timeline impact.** Per-seat billing adds one week; launch moves to Oct 27 [7], accepted by Maya [8].\n\n**Roadmap.** Slack integration first, then Zoom import [9]. Slack ≈ two sprints; tech spec by Oct 13 [10].\n\n**Mobile.** No native app in 2026 — responsive web only [11,12].\n\n**Risks.** Slack API rate limits may block real-time sync; batching likely needed [16].",
    "standard:developer":
      "Billing must switch from flat to per-seat ($39/seat/month), adding about a week — launch is now Oct 27 [6,7]. Heavy transcripts cost ~40 cents each to process, so cost efficiency matters [3]. Q4 engineering focus is the Slack integration (~two sprints, spec by Oct 13) then Zoom import [9,10]. Plan for batching because of Slack API rate limits [16]. No native mobile work this year [12].",
  },
  insights: [
    { type: "decision", text: "Pro moves to $39 per seat per month; free tier stays", importance: "high", confidence: 0.97, sources: [4, 6] },
    { type: "decision", text: "Launch date moves from Oct 20 to Oct 27", importance: "high", confidence: 0.93, sources: [7, 8] },
    { type: "key_point", text: "At $29 flat, AI costs eat 48% of revenue for heavy users", importance: "high", confidence: 0.95, sources: [2, 3] },
    { type: "decision", text: "Slack integration is the top Q4 priority, then Zoom import", importance: "medium", confidence: 0.94, sources: [9] },
    { type: "decision", text: "No native mobile app in 2026 — responsive web only", importance: "medium", confidence: 0.96, sources: [11, 12] },
    { type: "risk", text: "Slack API rate limits may block real-time sync", importance: "medium", confidence: 0.87, sources: [16] },
  ],
  actions: [
    { id: "s2-a1", task: "Write the Slack integration tech spec", owner: "Dev", due: "2026-10-13", priority: "high", status: "todo", confidence: 0.95, sources: [10] },
    { id: "s2-a2", task: "Update financial model with $39/seat pricing", owner: "Nina", due: "2026-10-09", priority: "high", status: "in_progress", confidence: 0.94, sources: [13] },
    { id: "s2-a3", task: "Tell Leo and Priya about the pricing change", owner: "Maya", due: "2026-10-06", priority: "medium", status: "done", confidence: 0.9, sources: [14, 15] },
    { id: "s2-a4", task: "Implement per-seat billing", owner: "Dev", due: "2026-10-27", priority: "high", status: "todo", confidence: 0.78, sources: [7] },
  ],
};

const supportAnalysis: Analysis = {
  title: "Duplicate charge & PDF export bug",
  tags: ["billing", "bug", "support"],
  summaries: {
    "tldr:executive":
      "Customer was double-charged $39; refund issued [4,6]. PDF export fails on transcripts over 500 messages — bug #4821, fix targeted Oct 14 [8,10].",
    "standard:executive":
      "Jordan Lee reported a duplicate Pro charge [1]. Ana confirmed two $39 charges on Oct 3 [4] and issued a refund that will appear within 5–7 business days [6]. Jordan also reported PDF export failures [5]; Ana reproduced it for transcripts over 500 messages and escalated it as bug #4821 [8].\n\nThe customer needs a fix before a board meeting next Thursday [9]. Engineering targets Oct 14, with Copy as Markdown as a workaround [10]. Ana will follow up by Oct 14 [12]. The customer ended satisfied [13]. Note: the customer shared sensitive payment details, which were masked [3].",
    "detailed:executive":
      "**Issue 1 — Billing.** Duplicate charge on the Pro plan [1]; two $39 charges on Oct 3 confirmed [4]. Refund issued, 5–7 business days [6].\n\n**Issue 2 — Product bug.** PDF export fails on large transcripts [5]. Reproduced above 500 messages, escalated as bug #4821 [8]. Fix targeted Oct 14; workaround is Copy as Markdown [10].\n\n**Customer context.** Needs the fix for a board meeting next Thursday [9]; asked for a phone call if the date slips [11].\n\n**Compliance.** The customer posted a full card number; agent advised against it [3,4].\n\n**Outcome.** Customer satisfied with the speed of help [13].",
    "standard:customer":
      "We found the duplicate $39 charge and refunded it — you'll see it in 5–7 business days [4,6]. The PDF export problem on large transcripts is a confirmed bug that our engineers plan to fix by Oct 14 [8,10]. Until then, Copy as Markdown works as a workaround [10], and we'll follow up with you by Oct 14 either way [12].",
  },
  insights: [
    { type: "key_point", text: "Customer was charged $39 twice on Oct 3; refund issued", importance: "high", confidence: 0.97, sources: [4, 6] },
    { type: "risk", text: "PDF export times out above 500 messages (bug #4821)", importance: "high", confidence: 0.95, sources: [5, 8] },
    { type: "key_point", text: "Customer needs the fix before a board meeting next Thursday", importance: "medium", confidence: 0.9, sources: [9] },
    { type: "risk", text: "Customer shared full card details in chat", importance: "medium", confidence: 0.92, sources: [3, 4] },
    { type: "key_point", text: "Copy as Markdown is the workaround until the fix", importance: "low", confidence: 0.94, sources: [10] },
  ],
  actions: [
    { id: "s3-a1", task: "Fix PDF export timeout for large transcripts (#4821)", owner: "Engineering", due: "2026-10-14", priority: "high", status: "in_progress", confidence: 0.93, sources: [8, 10] },
    { id: "s3-a2", task: "Follow up with Jordan on bug status", owner: "Ana (Support)", due: "2026-10-14", priority: "medium", status: "todo", confidence: 0.95, sources: [12] },
    { id: "s3-a3", task: "Call customer if the fix date slips", owner: "Ana (Support)", due: null, priority: "low", status: "todo", confidence: 0.82, sources: [11, 12] },
    { id: "s3-a4", task: "Process duplicate-charge refund", owner: "Ana (Support)", due: "2026-10-10", priority: "high", status: "done", confidence: 0.97, sources: [6] },
  ],
};

function build(
  id: string,
  raw: string,
  createdAt: string,
  analysis: Analysis,
): Conversation {
  const { messages, masked } = maskMessages(parseConversation(raw));
  return {
    id,
    title: analysis.title,
    createdAt,
    sourceType: "sample",
    tags: analysis.tags,
    messages,
    masked,
    status: "ready",
    analysis,
  };
}

export const SAMPLES: Conversation[] = [
  build("sample-startup", startupRaw, "2026-10-01T09:30:00Z", startupAnalysis),
  build("sample-meeting", meetingRaw, "2026-10-06T15:00:00Z", meetingAnalysis),
  build("sample-support", supportRaw, "2026-10-10T14:25:00Z", supportAnalysis),
];

export const SAMPLE_OPTIONS = [
  { id: "sample-startup", label: "Startup team chat", hint: "Pricing decision for launch" },
  { id: "sample-meeting", label: "Product meeting transcript", hint: "Pricing reversal & roadmap" },
  { id: "sample-support", label: "Customer support ticket", hint: "Billing + bug escalation" },
];
