"use client";

/**
 * Réplicas de las pantallas reales de URBAN del Capítulo 5 «Un paquete en portería».
 * - Centro de control: (guardstation)/guardstation/packages/new/page.tsx («Registrar paquete», SuccessPanel)
 *   y packages/page.tsx («Paquetería», DeliverPackageModal «Entregar paquete»).
 * - Push FCM: packages.service.ts («Tienes un paquete» / «Paquete entregado»).
 * - App Flutter: packages_screen.dart («Paquetes») y package_detail_screen.dart («Paquete»).
 */

import type { ReactNode } from "react";
import { DEMO } from "../../lib/urban/tour";
import { DATE_GUARD5, DELIV_DATE, MARIA5, PKG, RECV_DATE, clock5, type GuardView5, type PhoneView5 } from "../../lib/urban/tour5";
import { AppBar, I, StatusBar } from "./Screens";
import { GNAV, L } from "./Screens2";
import { Badge, I4, INFO, MUTED, Notif, OK, ShellNav, WARN } from "./Screens4";

type IP = { s?: number; c?: string };
const sv = (s: number, c: string, children: ReactNode) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const I5 = {
  truck: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>),
  info: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h0" /></>),
  back: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <path d="M19 12H5M11 6l-6 6 6 6" />),
  userCheck: ({ s = 14, c = "currentColor" }: IP) => sv(s, c, <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 11l2 2 4-4" /></>),
  chevD: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <path d="m6 9 6 6 6-6" />),
};
const CARRIERS = ["Servientrega", "Coordinadora", "472", "Interrapidísimo", "Envía", "TCC"];

/* ======================= App del residente ======================= */
function PkgList({ v }: { v: Extract<PhoneView5, { s: "list" }> }) {
  return (
    <div className="ua-screen">
      <StatusBar time={clock5(25).hm} />
      <div className="u4-inv">
        <div className="u4-inv-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u4-h">Paquetes</div>
            <div className="u4-hs">Tu correspondencia y envíos</div>
          </div>
        </div>
        <div className="u4-empty">
          <I.box s={44} c="#64748B" />
          <div className="u4-empty-t">No tienes paquetes</div>
          <div className="u4-empty-d">Cuando llegue uno aparecerá aquí con su estado.</div>
        </div>
      </div>
      <Notif k={v.notif} title="Tienes un paquete" body={`${PKG.carrier} disponible en portería · ${MARIA5.apt}`} />
      {v.press && <div className="u5-tap" />}
      <ShellNav on={3} />
    </div>
  );
}
function DRow({ ic, l, v, mono, accent }: { ic: ReactNode; l: string; v: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="u5-dr">
      <span className="u5-dr-ic" style={accent ? { color: OK } : undefined}>{ic}</span>
      <div style={{ minWidth: 0 }}>
        <div className="u5-dr-l">{l}</div>
        <div className={`u5-dr-v ${mono ? "is-mono" : ""}`} style={accent ? { color: OK } : undefined}>{v}</div>
      </div>
    </div>
  );
}
function PkgDetail({ v }: { v: Extract<PhoneView5, { s: "detail" }> }) {
  const d = v.delivered;
  return (
    <div className="ua-screen">
      <StatusBar time={v.time} />
      <AppBar title="Paquete" back />
      <div className="u5-det">
        <div className="ua-card u5-card">
          <div className="u5-sh">
            <span className="u5-pic"><I.box s={28} c="#3B82F6" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="u5-carrier">{PKG.carrier}</div>
              {d ? <Badge l="Entregado" c={OK} /> : <Badge l="Pendiente de recoger" c={WARN} />}
            </div>
          </div>
          <div className="u5-desc">{PKG.desc}</div>
        </div>
        <div className="ua-card u5-card u5-rows">
          <DRow ic={<I5.truck />} l="Transportadora" v={PKG.carrier} />
          <DRow ic={<I4.hash s={18} />} l="Guía / tracking" v={PKG.tracking} mono />
          <DRow ic={<L.building s={18} />} l="Apartamento" v={MARIA5.apt} />
          <DRow ic={<L.cal s={18} />} l="Recibido" v={RECV_DATE} />
          <DRow ic={<I4.shield s={18} />} l="Recibido por" v={DEMO.carlos} />
          {d && <DRow ic={<L.check2 s={18} />} l="Entregado" v={DELIV_DATE} accent />}
          {d && <DRow ic={<I4.person s={18} />} l="Entregado a" v={DEMO.maria} />}
        </div>
        {!d && (
          <div className="ua-card u5-card u5-tip">
            <I5.info c="#3B82F6" />
            <span>Pasa por portería con tu documento para recoger el paquete.</span>
          </div>
        )}
      </div>
      <Notif k={v.notif} title="Paquete entregado" body={`${PKG.carrier} entregado a ${DEMO.maria} · ${MARIA5.apt}`} />
    </div>
  );
}
export function PhoneScreen5({ v }: { v: PhoneView5 }) {
  return (
    <div className="ua-phone">
      <div className="ua-notch" />
      <div className="ua-phone-in">{v.s === "list" ? <PkgList v={v} /> : <PkgDetail v={v} />}</div>
    </div>
  );
}

/* ======================= Centro de control ======================= */
function UBadge({ l, c }: { l: string; c: string }) {
  return <span className="u5-ub" style={{ color: c, background: `${c}26` }}>{l}</span>;
}
function Av({ s = 32 }: { s?: number }) {
  return <span className="u5-av" style={{ width: s, height: s, fontSize: s * 0.38 }}>MR</span>;
}
function Input({ label, ph, v, focus, ic }: { label?: string; ph: string; v: string; focus: boolean; ic?: ReactNode }) {
  return (
    <div className="u5-field">
      {label && <label>{label}</label>}
      <div className={`u5-in ${focus ? "is-focus" : ""}`}>
        {ic}
        {v ? <span className="u5-in-v">{v}{focus && <i className="u5-caret" />}</span> : <span className="u5-in-ph">{focus && <i className="u5-caret" />}{ph}</span>}
      </div>
    </div>
  );
}
function NewPage({ v, compact }: { v: Extract<GuardView5, { page: "new" }>; compact: boolean }) {
  const showLeft = !compact || !v.selected || v.t < 16.4;
  const showRight = !compact || (v.selected && v.t >= 16.4);
  if (v.done)
    return (
      <div className="u5-card-g u5-success">
        <span className="u5-ok"><L.check2 s={32} /></span>
        <h2>Paquete registrado</h2>
        <p>{PKG.carrier} · destinatario <b>{DEMO.maria}</b></p>
        <p className="u5-xs">Se envió notificación al apartamento {MARIA5.apt}.</p>
        <div className="u5-btns">
          <span className="u5-btn is-ghost">Volver al listado</span>
          <span className="u5-btn"><L.pkg s={14} /> Registrar otro</span>
        </div>
      </div>
    );
  return (
    <div className="u5-grid">
      {showLeft && (
        <div className="u5-card-g u5-left">
          <div className="u5-ch">
            <span className="u5-num" style={v.selected ? { background: `${OK}2e`, color: OK } : undefined}>{v.selected ? <L.check2 s={16} /> : "1"}</span>
            <h2>Destinatario</h2>
            <span style={{ flex: 1 }} />
            {v.selected && <span className="u5-chg"><I4.x s={12} /> Cambiar</span>}
          </div>
          {v.selected ? (
            <div className="u5-sel">
              <div className="u5-sel-r">
                <Av s={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="u5-nm">{DEMO.maria} <span className="u5-tit">Titular</span></p>
                  <p className="u5-sm"><L.building s={12} /> {MARIA5.floor}</p>
                  <p className="u5-sm">{`${MARIA5.doc} · ${MARIA5.phone}`}</p>
                </div>
                <UBadge l="Propietario" c={OK} />
              </div>
              <p className="u5-push">✓ Recibirá notificación push al registrarse el paquete.</p>
            </div>
          ) : (
            <>
              <Input ph="Buscar por nombre, apellido o documento…" v={v.q} focus={v.focus === "q"} ic={<I4.search c={MUTED} />} />
              {v.results ? (
                <ul className="u5-res">
                  <li className={v.press === 1 ? "is-press" : ""}>
                    <Av />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="u5-nm">{DEMO.maria} <span className="u5-tit">Titular</span></p>
                      <p className="u5-sm">{`Torre A · Apto 501 · ${MARIA5.doc}`}</p>
                    </div>
                    <UBadge l="Propietario" c={OK} />
                  </li>
                </ul>
              ) : (
                <p className="u5-hint">{v.searching ? "Buscando…" : "Escribe al menos 2 letras para buscar en la base de datos del conjunto."}</p>
              )}
            </>
          )}
        </div>
      )}
      {showRight && (
        <div className="u5-card-g u5-right">
          <div className="u5-ch">
            <span className="u5-num" style={v.selected ? { background: `${WARN}2e`, color: WARN } : { background: "rgba(148,163,184,.12)", color: MUTED }}>2</span>
            <h2>Datos del paquete</h2>
          </div>
          <Input label="Empresa transportadora *" ph="Servientrega, Coordinadora, 472…" v={v.chip ? PKG.carrier : ""} focus={v.focus === "carrier"} />
          <div className="u5-chips">
            {CARRIERS.map((c, i) => (
              <span key={c} className={`${i === 0 && v.chip ? "on" : ""} ${i === 0 && v.press === 2 ? "is-press" : ""}`}>{c}</span>
            ))}
          </div>
          <Input label="Número de guía / tracking" ph="Opcional · Ej. ABC123456789" v={v.tracking} focus={v.focus === "tracking"} />
          <Input label="Descripción" ph="Ej. Caja mediana, sobre, bolsa…" v={v.desc} focus={v.focus === "desc"} />
          {!compact && (
            <div className="u5-field">
              <label>Notas internas</label>
              <div className="u5-in u5-ta"><span className="u5-in-ph">Visibles solo para portería</span></div>
            </div>
          )}
          <div className="u5-btns">
            <span className="u5-btn is-ghost">Cancelar</span>
            <span className={`u5-btn is-grow ${v.selected && v.chip ? "" : "is-dis"} ${v.press === 3 ? "is-press" : ""}`}><L.pkg s={14} /> {v.busy ? "Registrando…" : "Registrar paquete"}</span>
          </div>
          {!v.selected && <p className="u5-xs">Selecciona primero un destinatario en la columna izquierda.</p>}
        </div>
      )}
    </div>
  );
}
function Kpi({ ic, l, n, c }: { ic: ReactNode; l: string; n: number; c: string }) {
  return (
    <div className="u5-kpi">
      <span style={{ color: c, background: `${c}26` }}>{ic}</span>
      <div>
        <p>{l}</p>
        <b>{n}</b>
      </div>
    </div>
  );
}
function ListPage({ v, compact }: { v: Extract<GuardView5, { page: "list" }>; compact: boolean }) {
  const n = v.done ? 0 : 1;
  return (
    <>
      <div className="u5-ph">
        <span className="uw-ph-ic"><L.pkg s={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Paquetería</h1>
          <p>{n === 1 ? "1 paquete pendiente de entrega" : "0 paquetes pendientes de entrega"}</p>
        </div>
        <span className="u5-btn"><I4.plus s={14} /> Registrar paquete</span>
      </div>
      {!compact && (
        <div className="u5-kpis">
          <Kpi ic={<L.pkg s={18} />} l="Pendientes" n={n} c={WARN} />
          <Kpi ic={<I5.userCheck s={18} />} l="Apartamentos con paquete" n={n} c={INFO} />
          <Kpi ic={<L.pkg s={18} />} l="Hoy" n={n} c="#3B82F6" />
        </div>
      )}
      <div className="u5-card-g u5-filter">
        <div className="u5-in"><I4.search c={MUTED} /> <span className="u5-in-ph">Buscar por carrier, tracking o apartamento…</span></div>
      </div>
      {v.done ? (
        <div className="u5-card-g u5-empty">
          <L.pkg s={28} c={MUTED} />
          <b>No hay paquetes pendientes</b>
          <span>Al registrar uno, aparecerá aquí hasta que el residente lo recoja.</span>
        </div>
      ) : (
        <div className="u5-card-g u5-row">
          <span className="u5-pkic"><L.pkg s={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u5-row-h"><b>{PKG.carrier}</b> <UBadge l="Pendiente" c={WARN} /></div>
            <p className="u5-sm">{`${MARIA5.apt} · ${PKG.tracking} · ${PKG.desc}`}</p>
            <p className="u5-xs">Recibido hace 2 h por {DEMO.carlos}</p>
          </div>
          <span className={`u5-btn ${v.press ? "is-press" : ""}`}><I5.userCheck /> Entregar</span>
        </div>
      )}
    </>
  );
}
function DeliverModal({ confirm, busy }: { confirm: boolean; busy: boolean }) {
  return (
    <div className="u4-dlg-bg">
      <div className="u5-modal">
        <h2>Entregar paquete</h2>
        <p className="u5-sm">{`${PKG.carrier} · ${MARIA5.apt}`}</p>
        <div className="u5-field">
          <label>¿Quién recibe?</label>
          <div className="u5-in u5-select"><span>{DEMO.maria} (OWNER)</span><I5.chevD c={MUTED} /></div>
        </div>
        <div className="u5-btns u5-end">
          <span className="u5-btn is-ghost">Cancelar</span>
          <span className={`u5-btn ${confirm ? "is-press" : ""}`}><I5.userCheck /> {busy ? "Registrando…" : "Confirmar entrega"}</span>
        </div>
      </div>
    </div>
  );
}

export function GuardPanel5({ v, compact }: { v: GuardView5; compact: boolean }) {
  const now = clock5(v.t).h12pad;
  const isNew = v.page === "new";
  return (
    <div className="uw-win">
      <div className="uw-chrome">
        <i /><i /><i />
        <span className="uw-url">{isNew ? "/guardstation/packages/new" : "/guardstation/packages"}</span>
      </div>
      <div className="uw-app">
        {!compact && (
          <aside className="uw-side">
            <div className="uw-side-h" style={{ height: 64 }}>
              <span className="uw-side-logo"><L.building /></span>
              <div>
                <div className="uw-b uw-sm">URBAN</div>
                <div className="uw-muted uw-xs">Centro de Control</div>
              </div>
            </div>
            <nav className="ug-nav">
              <div className="ug-nav-in is-top">
                {GNAV.map(([l, Ic]) => (
                  <div key={l} className={`ug-nav-i ${l === "Paquetería" ? "on" : ""}`}>
                    <Ic s={20} /> <span>{l}</span>
                  </div>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <div className="uw-main">
          <header className="ug-top">
            <div>
              <div className="uw-b uw-sm">URBAN — Centro de Control</div>
              <div className="uw-muted" style={{ fontSize: 11 }}>Turno Tarde · {DATE_GUARD5}</div>
            </div>
            {!compact && (
              <div className="ug-clock">
                <b>{now}</b>
                <span>Hora local</span>
              </div>
            )}
            <span style={{ flex: 1 }} />
            {!compact && <span className="ug-sos"><i /> <L.siren /> Activar alerta</span>}
            <span className="ug-live"><L.wifi s={14} /> {!compact && "En vivo"} <i /></span>
            {!compact && <span className="ug-cams"><L.video /> 0 cámaras</span>}
            <span className="uw-top-ic"><L.bell /></span>
            <span className="ug-user">
              <span className="ug-av"><L.user /></span>
              {!compact && (
                <span className="ug-user-t">
                  <b>{DEMO.carlos}</b>
                  <span>GUARD</span>
                </span>
              )}
            </span>
          </header>
          <div className="ug-content u4-gc">
            {isNew ? (
              <>
                <div className="u5-ph">
                  <span className="u5-backb"><I5.back /></span>
                  <span className="uw-ph-ic"><L.pkg s={22} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h1>Registrar paquete</h1>
                    <p>Asigna el paquete al residente o propietario destinatario</p>
                  </div>
                </div>
                <NewPage v={v} compact={compact} />
              </>
            ) : (
              <ListPage v={v} compact={compact} />
            )}
          </div>
        </div>
        {v.page === "list" && v.modal && <DeliverModal confirm={v.confirm} busy={v.busy} />}
      </div>
    </div>
  );
}
