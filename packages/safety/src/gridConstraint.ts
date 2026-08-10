import type { AuditEvent, GridSignal, Role } from "@victron-ems14a/domain";

export class ForbiddenGridWriteError extends Error {
  readonly audit: AuditEvent;

  constructor(role: Role, detail: Record<string, unknown>) {
    super(`Role '${role}' must not modify GridConstraint`);
    this.name = "ForbiddenGridWriteError";
    this.audit = {
      kind: "forbidden_write",
      at: new Date().toISOString(),
      role,
      detail: { target: "GridConstraint", ...detail },
    };
  }
}

/**
 * Holds the authoritative grid ceiling. Only `system` (or installer bootstrap)
 * may update it – never enduser config.
 */
export class GridConstraint {
  private signal: GridSignal;

  constructor(initial?: GridSignal) {
    this.signal = initial ?? {
      source: "aux",
      mode: "normal",
      maxSteuveGridKw: Number.POSITIVE_INFINITY,
      receivedAt: new Date().toISOString(),
    };
  }

  getSnapshot(): GridSignal {
    return { ...this.signal };
  }

  /** Ceiling in kW for netzwirksamen SteuVE-Bezug. */
  getCeilingKw(): number {
    if (this.signal.mode === "off") return 0;
    if (this.signal.mode === "normal") {
      return this.signal.maxSteuveGridKw;
    }
    return this.signal.maxSteuveGridKw;
  }

  applySignal(role: Role, signal: GridSignal): AuditEvent {
    if (role === "enduser") {
      throw new ForbiddenGridWriteError(role, { attemptedSignal: signal });
    }
    if (role === "installer" && signal.source !== "manual_installer") {
      // Installer may only set explicit manual bootstrap signals.
      throw new ForbiddenGridWriteError(role, {
        reason: "installer_only_manual_installer_source",
        attemptedSignal: signal,
      });
    }
    if (role === "system" && signal.source === "manual_installer") {
      throw new ForbiddenGridWriteError(role, {
        reason: "system_must_use_grid_sources",
        attemptedSignal: signal,
      });
    }

    this.signal = { ...signal };
    return {
      kind: "grid_signal",
      at: new Date().toISOString(),
      role,
      detail: { signal: this.signal, ceilingKw: this.getCeilingKw() },
    };
  }
}
