import { Component, OnDestroy, WritableSignal, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { CalculatorService } from '../../services/calculator.service';
import { GeminiService } from '../../services/gemini.service';
import { GroqService } from '../../services/groq.service';
import { AiProviderError, ChatTurn } from '../../services/ai-http.util';
import { fmtINR, fmtPct } from '../../shared/format';

type Tab = 'explain' | 'fill' | 'chat';

const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';
const GROQ_KEY_URL = 'https://console.groq.com/keys';

function stripFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  return trimmed;
}

@Component({
  imports: [],
  selector: 'app-ai-assistant',
  styleUrl: './ai-assistant.scss',
  templateUrl: './ai-assistant.html',
})
export class AiAssistant implements OnDestroy {
  protected readonly calc = inject(CalculatorService);
  private readonly gemini = inject(GeminiService);
  private readonly groq = inject(GroqService);

  protected readonly hasKey = this.gemini.hasKey;
  protected readonly hasGroqKey = this.groq.hasKey;
  protected readonly keyInput = signal('');
  protected readonly showKeyField = signal(false);
  protected readonly keyPagePending = signal(false);
  protected readonly clipboardNote = signal('');

  protected readonly showGroqSetup = signal(false);
  protected readonly groqKeyInput = signal('');
  protected readonly groqKeyPagePending = signal(false);
  protected readonly groqClipboardNote = signal('');

  private browserFinishedListener: { remove: () => void } | null = null;
  private popupPollTimer: number | null = null;
  private groqPopupPollTimer: number | null = null;

  protected readonly activeTab = signal<Tab>('explain');

  protected readonly explainText = signal('');
  protected readonly explainPending = signal(false);
  protected readonly explainError = signal('');

  protected readonly fillInput = signal('');
  protected readonly fillPending = signal(false);
  protected readonly fillError = signal('');
  protected readonly fillApplied = signal(false);

  protected readonly chatMessages = signal<ChatTurn[]>([]);
  protected readonly chatInput = signal('');
  protected readonly chatPending = signal(false);
  protected readonly chatError = signal('');

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  async openKeyPage(): Promise<void> {
    await this.openProviderKeyPage(GEMINI_KEY_URL, this.keyInput, this.keyPagePending, this.clipboardNote, 'gemini', (t) => (this.popupPollTimer = t));
  }

  async openGroqKeyPage(): Promise<void> {
    await this.openProviderKeyPage(GROQ_KEY_URL, this.groqKeyInput, this.groqKeyPagePending, this.groqClipboardNote, 'groq', (t) => (this.groqPopupPollTimer = t));
  }

  private async openProviderKeyPage(
    url: string,
    targetInput: WritableSignal<string>,
    pending: WritableSignal<boolean>,
    note: WritableSignal<string>,
    which: 'gemini' | 'groq',
    setTimer: (t: number | null) => void
  ): Promise<void> {
    if (pending()) return;
    pending.set(true);
    note.set('');

    if (Capacitor.isNativePlatform()) {
      this.browserFinishedListener?.remove();
      this.browserFinishedListener = await Browser.addListener('browserFinished', () => {
        this.browserFinishedListener?.remove();
        this.browserFinishedListener = null;
        pending.set(false);
        void this.pasteFromClipboard(targetInput, note, true);
      });
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    }

    // Web/PWA: a small centered popup, like a typical OAuth sign-in window —
    // address bar visible (so the user can verify the real domain), toolbar/menubar hidden.
    const width = 480;
    const height = 760;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=yes,noopener,noreferrer`;
    const popup = window.open(url, `${which}ApiKey`, features);

    if (!popup) {
      // Popup blocked — fall back to a normal tab rather than silently failing.
      window.open(url, '_blank', 'noopener,noreferrer');
      pending.set(false);
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        setTimer(null);
        pending.set(false);
        void this.pasteFromClipboard(targetInput, note, true);
      }
    }, 500);
    setTimer(timer);
  }

  async pasteFromClipboard(targetInput: WritableSignal<string> = this.keyInput, note: WritableSignal<string> = this.clipboardNote, silent = false): Promise<void> {
    try {
      const { value } = await Clipboard.read();
      const trimmed = value?.trim() ?? '';
      if (trimmed && trimmed.length < 400 && !/\s/.test(trimmed)) {
        targetInput.set(trimmed);
        note.set('Pasted from clipboard — check it looks right, then save.');
      } else if (!silent) {
        note.set("Clipboard doesn't look like an API key — paste it manually.");
      }
    } catch {
      if (!silent) {
        note.set('Clipboard access was denied — paste the key manually instead.');
      }
    }
  }

  saveKey(): void {
    if (!this.keyInput().trim()) return;
    this.gemini.setApiKey(this.keyInput());
    this.keyInput.set('');
    this.showKeyField.set(false);
  }

  forgetKey(): void {
    this.gemini.clearApiKey();
    this.explainText.set('');
    this.chatMessages.set([]);
  }

  saveGroqKey(): void {
    if (!this.groqKeyInput().trim()) return;
    this.groq.setApiKey(this.groqKeyInput());
    this.groqKeyInput.set('');
    this.groqClipboardNote.set('');
  }

  forgetGroqKey(): void {
    this.groq.clearApiKey();
  }

  private buildContext(): string {
    const c = this.calc;
    return [
      `Monthly household income: ${fmtINR(c.monthlyIncome())}, age ${c.age()}, ${c.employmentType() === 'self' ? 'self-employed' : 'salaried'}.`,
      `Existing monthly EMIs/debt: ${fmtINR(c.existingEMIs())}. Monthly SIP/investments: ${fmtINR(c.sipMonthly())}.`,
      `Car on-road price: ${fmtINR(c.onRoadPrice())}. Down payment: ${c.downPaymentPct()}% (${fmtINR(c.downAmt())}). Loan: ${fmtINR(c.loanAmt())} at ${c.interestRate()}% for ${c.loanTenureYears()} years -> EMI ${fmtINR(c.emi())}/month.`,
      `Fuel type: ${c.fuelType()}. Monthly driving: ${c.monthlyKm()} km. Running costs: fuel ${fmtINR(c.fuelMonthly())}/mo, insurance ${fmtINR(c.insuranceMonthly())}/mo, maintenance ${fmtINR(c.maintenanceMonthly())}/mo.`,
      `Total monthly cost: ${fmtINR(c.totalMonthly())} (EMI is ${fmtPct(c.emiPct())} of income, total car cost is ${fmtPct(c.carCostPct())} of income, total committed outflow is ${fmtPct(c.debtPct())} of income).`,
      `Verdict: "${c.verdictTitle()}" (affordability score ${c.affordabilityScore()}/100). Checklist: down payment >=20% ${c.downPaymentPass() ? 'PASS' : 'FAIL'}, tenure <=4yr ${c.tenurePass() ? 'PASS' : 'FAIL'}, total cost <=10% of income ${c.totalCostPass() ? 'PASS' : 'FAIL'}.`,
      `Ownership horizon: ${c.ownershipYears()} years at ${c.depreciationRatePct()}%/yr depreciation. Estimated resale value: ${fmtINR(c.resaleValue())}.`,
    ].join('\n');
  }

  /** Tries Gemini first; if it fails (for any reason other than "no key set") and a Groq
   *  key is configured, silently retries via Groq before surfacing the original error. */
  private async callWithFallback(
    geminiCall: () => Promise<string>,
    groqCall: () => Promise<string>
  ): Promise<string> {
    try {
      return await geminiCall();
    } catch (e) {
      const canFallback = this.groq.hasKey() && e instanceof AiProviderError && e.kind !== 'no-key';
      if (!canFallback) throw e;
      try {
        return await groqCall();
      } catch {
        throw e; // report the original (Gemini) failure — it's the primary provider
      }
    }
  }

  async explain(): Promise<void> {
    if (!this.gemini.hasKey() || this.explainPending()) return;
    this.explainPending.set(true);
    this.explainError.set('');
    try {
      const system =
        "You are a plain-spoken financial explainer inside a car affordability calculator for Indian buyers. " +
        "Given the user's numbers, write a short (3-5 sentence), friendly, honest explanation of whether this car fits their budget and why. " +
        "Mention the single biggest driver of the result. No markdown, no headers, just prose. Do not just repeat the numbers back; interpret them.";
      const context = this.buildContext();
      const text = await this.callWithFallback(
        () => this.gemini.generate(context, system),
        () => this.groq.generate(context, system)
      );
      this.explainText.set(text.trim());
    } catch (e) {
      this.explainError.set(e instanceof AiProviderError ? e.message : 'Something went wrong.');
    } finally {
      this.explainPending.set(false);
    }
  }

  async runFill(): Promise<void> {
    const raw = this.fillInput().trim();
    if (!raw || !this.gemini.hasKey() || this.fillPending()) return;
    this.fillPending.set(true);
    this.fillError.set('');
    this.fillApplied.set(false);
    try {
      const system =
        "Extract car-affordability-calculator inputs from the user's free-text description. " +
        'Respond with ONLY a JSON object (no markdown fences, no commentary). Only include keys the user actually implied; omit anything not mentioned. ' +
        'Valid keys and types: monthlyIncome (number, INR/month), age (number), employmentType ("salaried"|"self"), ' +
        'existingEMIs (number, INR/month), sipMonthly (number, INR/month), onRoadPrice (number, INR), ' +
        'downPaymentPct (number, 0-100), interestRate (number, percent p.a.), loanTenureYears (number), ' +
        'fuelType ("petrol"|"diesel"|"cng"|"electric"), monthlyKm (number), ownershipYears (number). ' +
        'Convert "lakh" to value*100000 and "crore" to value*10000000.';
      const jsonText = await this.callWithFallback(
        () => this.gemini.generateJson(raw, system),
        () => this.groq.generateJson(raw, system)
      );
      const parsed = JSON.parse(stripFences(jsonText)) as Record<string, unknown>;
      const applied = this.applyFill(parsed);
      if (applied === 0) {
        this.fillError.set("Couldn't find any recognizable details in that — try including specific numbers.");
      } else {
        this.fillApplied.set(true);
        this.fillInput.set('');
      }
    } catch (e) {
      this.fillError.set(e instanceof AiProviderError ? e.message : 'Could not understand that — try rephrasing.');
    } finally {
      this.fillPending.set(false);
    }
  }

  private applyFill(f: Record<string, unknown>): number {
    const c = this.calc;
    let count = 0;
    const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
    let n: number | null;
    if ((n = num(f['monthlyIncome'])) !== null) { c.monthlyIncome.set(n); count++; }
    if ((n = num(f['age'])) !== null) { c.age.set(n); count++; }
    if (f['employmentType'] === 'salaried' || f['employmentType'] === 'self') { c.employmentType.set(f['employmentType']); count++; }
    if ((n = num(f['existingEMIs'])) !== null) { c.existingEMIs.set(n); count++; }
    if ((n = num(f['sipMonthly'])) !== null) { c.sipMonthly.set(n); count++; }
    if ((n = num(f['onRoadPrice'])) !== null) { c.onRoadPrice.set(n); count++; }
    if ((n = num(f['downPaymentPct'])) !== null) { c.downPaymentPct.set(n); count++; }
    if ((n = num(f['interestRate'])) !== null) { c.interestRate.set(n); count++; }
    if ((n = num(f['loanTenureYears'])) !== null) { c.loanTenureYears.set(n); count++; }
    const fuel = f['fuelType'];
    if (fuel === 'petrol' || fuel === 'diesel' || fuel === 'cng' || fuel === 'electric') { c.onFuelTypeChange(fuel); count++; }
    if ((n = num(f['monthlyKm'])) !== null) { c.monthlyKm.set(n); count++; }
    if ((n = num(f['ownershipYears'])) !== null) { c.ownershipYears.set(n); count++; }
    return count;
  }

  async sendChat(): Promise<void> {
    const text = this.chatInput().trim();
    if (!text || !this.gemini.hasKey() || this.chatPending()) return;
    this.chatPending.set(true);
    this.chatError.set('');
    const history = [...this.chatMessages(), { role: 'user' as const, text }];
    this.chatMessages.set(history);
    this.chatInput.set('');
    try {
      const system =
        'You are a concise, honest car-affordability advisor for Indian buyers, embedded in a calculator app. ' +
        "Answer using the user's current numbers below. For what-if questions, suggest concrete specific tweaks (an exact down payment %, tenure, or price). " +
        'Keep answers under 120 words, plain prose, no markdown.\n\nCurrent numbers:\n' + this.buildContext();
      const reply = await this.callWithFallback(
        () => this.gemini.chat(history, system),
        () => this.groq.chat(history, system)
      );
      this.chatMessages.set([...history, { role: 'model', text: reply.trim() }]);
    } catch (e) {
      this.chatError.set(e instanceof AiProviderError ? e.message : 'Something went wrong.');
    } finally {
      this.chatPending.set(false);
    }
  }

  ngOnDestroy(): void {
    this.browserFinishedListener?.remove();
    if (this.popupPollTimer) window.clearInterval(this.popupPollTimer);
    if (this.groqPopupPollTimer) window.clearInterval(this.groqPopupPollTimer);
  }
}
