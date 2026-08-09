import type { AuditEvent, FeedInSignal, Role } from "@victron-ems14a/domain";

export class ForbiddenFeedInWriteError extends Error {
  readonly audit: AuditEvent;

  constructor(role: Role, detail: Record<string, unknown>) {
    super(`Role '${role}' must not modify FeedInConstraint (EEG §9)`);
    this.name = "ForbiddenFeedInWriteError";
    this.audit = {
      kind: "forbidden_write",
      at: new Date().toISOString(),
      role,
      detail: { target: "FeedInConstraint", ...detail },
    };
  }
}

/**
 * Authoritative EEG §9 feed-in ceiling. Only system/installer bootstrap may update.
 */
export class FeedInConstraint {
  private signal: FeedInSignal;

  constructor(initial?: FeedInSignal) {
    this.signal = initial ?? {
      source: "steuerbox",
      mode: "normal",
      maxFeedInPercent: 1,
      receivedAt: new Date().toISOString(),
    };
  }

  getSnapshot(): FeedInSignal {
    return { ...this.signal };
  }

  /**
   * Resolve absolute max export kW given plant rated power.
   */
  getMaxFeedInKw(pvRatedKw: number): number {
    if (this.signal.mode === "zero") return 0;
    if (this.signal.maxFeedInKw !== undefined) {
      return Math.max(0, this.signal.maxFeedInKw);
    }
    const pct = this.signal.maxFeedInPercent ?? 1;
    if (this.signal.mode === "normal" && pct >= 1 && this.signal.maxFeedInKw === undefined) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, pvRatedKw * pct);
  }

  applySignal(role: Role, signal: FeedInSignal): AuditEvent {
    if (role === "enduser") {
      throw new ForbiddenFeedInWriteError(role, { attemptedSignal: signal });
    }
    if (role === "installer" && signal.source !== "manual_installer") {
      throw new ForbiddenFeedInWriteError(role, {
        reason: "installer_only_manual_installer_source",
        attemptedSignal: signal,
      });
    }
    this.signal = { ...signal };
    return {
      kind: "feedin_signal",
      at: new Date().toISOString(),
      role,
      detail: { signal: this.signal },
    };
  }
}
