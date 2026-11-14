"use client";

/**
 * Réplicas de las pantallas reales de URBAN que aparecen en el Capítulo 4 «Invitados, sin códigos».
 * - App Flutter: invitations_screen.dart, new_invitation_screen.dart, qr_screen.dart («Estado de la invitación»).
 * - Centro de control: (guardstation)/guardstation/access/page.tsx («Ingresos»), exits/page.tsx («Salidas»),
 *   PendingInvitationsList.tsx, InvitationDetailView.tsx, AuthorizeEntryButton.tsx (diálogos de confirmación).
 * - Push FCM: visitors-notifier.service.ts («Tu invitado ingresó» / «Tu invitado salió»).
 * Sin QR, sin PIN y sin foto del visitante (rediseño UX 2026 del código fuente).
 */

import type { ReactNode } from "react";
import { DEMO } from "../../lib/urban/tour";
import { ANDRES, DATE4, DATE_GUARD4, DATE_LONG4, ENTRY_12, ENTRY_HM, EXIT_HM, MARIA4, WIN4, clock4, expiresIn, type GuardView4, type PhoneView4 } from "../../lib/urban/tour4";
import { AppBar, Btn, I, StatusBar } from "./Screens";
import { GNAV, L } from "./Screens2";

type IP = { s?: number; c?: string };
const sv = (s: number, c: string, children: ReactNode) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
export const I4 = {
  plus: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M12 5v14M5 12h14" />),
  chev: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="m9 6 6 6-6 6" />),
  person: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  moto: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17h6l-3-7h-3M14 7h3l1.5 10" /></>),
  tool: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />),
  car: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><path d="M5 17h14v-5l-2-5H7l-2 5zM5 12h14" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /></>),
  calendar: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
  time: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  event: ({ s = 48, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4" /></>),
  hourglass: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4" />),
  callIn: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />),
  cancel: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
  check: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  search: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  pin: ({ s = 13, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>),
  door: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.56v16.88a.5.5 0 0 1-.6.49L5 20V5.56a1 1 0 0 1 .7-.95l6-1.92a1 1 0 0 1 1.3.95z" /></>),
  x: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <path d="M18 6 6 18M6 6l12 12" />),
  idc: ({ s = 12, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15a2 2 0 1 1 4 0M9 11h0M14 10h4M14 14h3" /></>),
  hash: ({ s = 12, c = "currentColor" }: IP) => sv(s, c, <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />),
  shield: ({ s = 12, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>),
  alertT: ({ s = 14, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></>),
};

/* ======================= App del residente ======================= */
export function Avatar({ t, size = 44 }: { t: string; size?: number }) {
  return (
    <span className="u4-av" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {t}
    </span>
  );
}
export function Badge({ l, c }: { l: string; c: string }) {
  return (
    <span className="u4-badge" style={{ color: c, background: `${c}26`, borderColor: `${c}55` }}>
      {l}
    </span>
  );
}
export const BLUE = "#3B82F6";
export const INFO = "#38BDF8";
export const OK = "#22C55E";
export const WARN = "#F59E0B";
export const MUTED = "#64748B";

export function Notif({ k, title, body }: { k: number; title: string; body: string }) {
  if (k <= 0) return null;
  return (
    <div className="ua-notif u4-notif" style={{ transform: `translateY(${(1 - k) * -180}px)`, opacity: Math.min(1, k * 1.6) }}>
      <div className="ua-notif-h">
        <span className="u4-app-ic"><I.building s={11} c="#fff" /></span> URBAN · ahora
      </div>
      <div className="ua-notif-t">{title}</div>
      <div className="ua-notif-b">{body}</div>
    </div>
  );
}

export function ShellNav({ on = 1 }: { on?: number } = {}) {
  const c = (i: number) => (i === on ? "#F1F5F9" : "#94A3B8");
  return (
    <div className="ua-nav">
      {[
        ["Inicio", <I.home key="h" c={c(0)} />],
        ["Invitaciones", <I.qr key="q" s={22} c={c(1)} />],
        ["Portería", <I.forum key="f" c={c(2)} />],
        ["Paquetes", <I.box key="b" s={22} c={c(3)} />],
        ["Perfil", <I.person key="p" c={c(4)} />],
      ].map(([l, ic], i) => (
        <div key={String(l)} className={`ua-nav-i ${i === on ? "on" : ""}`}>
          <span className="ua-nav-pill">{ic}</span>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function ListScreen({ v }: { v: Extract<PhoneView4, { s: "list" }> }) {
  return (
    <div className="ua-screen">
      <StatusBar time={clock4(v.t).hm} />
      <div className="u4-inv">
        <div className="u4-inv-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u4-h">Invitaciones</div>
            <div className="u4-hs">Gestiona y sigue el estado de tus visitas</div>
          </div>
          <span className="ua-live u4-livedot"><i /> 1 en línea</span>
        </div>
        <div className="u4-tabs">
          <span className="on">Activas</span>
          <span>Historial</span>
          <span>Mis visitantes</span>
        </div>
        {v.mode === "empty" ? (
          <div className="u4-empty">
            <I4.event s={44} c="#64748B" />
            <div className="u4-empty-t">Sin invitaciones activas</div>
            <div className="u4-empty-d">Crea una invitación para que tus visitantes puedan ingresar.</div>
            <span className="u4-btn-sm"><I4.plus s={16} /> Nueva invitación</span>
          </div>
        ) : (
          <div className="u4-rows">
            <div className={`ua-card u4-row ${v.press ? "is-press" : ""}`}>
              <Avatar t={ANDRES.initials} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="u4-row-t">{ANDRES.name}</div>
                <div className="u4-row-s">{`${DATE4} · ${WIN4.start}`}</div>
              </div>
              {v.mode === "inside" ? <Badge l="Adentro" c={OK} /> : <Badge l="Activa" c={INFO} />}
            </div>
          </div>
        )}
      </div>
      <span className={`u4-fab ${v.press && v.mode === "empty" ? "is-press" : ""}`}><I4.plus s={20} c="#fff" /> Nueva</span>
      {v.snack > 0 && <div className="u4-snack">Invitación generada</div>}
      <ShellNav />
    </div>
  );
}

function StepH({ n, t, s }: { n: number; t: string; s: string }) {
  return (
    <div className="u4-step">
      <span className="u4-step-n">{n}</span>
      <div>
        <div className="u4-step-t">{t}</div>
        <div className="u4-step-s">{s}</div>
      </div>
    </div>
  );
}
function Field({ label, value, focus }: { label: string; value: string; focus?: boolean }) {
  return (
    <div className={`u4-in ${focus ? "is-focus" : ""} ${value || focus ? "has-v" : ""}`}>
      <span className="u4-in-l">{label}</span>
      <span className="u4-in-v">
        {value}
        {focus && <i className="ua-caret" />}
      </span>
    </div>
  );
}
function Chip({ l, ic, on }: { l: string; ic: ReactNode; on?: boolean }) {
  return (
    <span className={`u4-chip ${on ? "on" : ""}`}>
      {ic} {l}
    </span>
  );
}

function FormScreen({ v }: { v: Extract<PhoneView4, { s: "form" }> }) {
  return (
    <div className="ua-screen">
      <StatusBar time="16:51" />
      <AppBar title="Nueva Invitación" back />
      <div className="u4-form-vp">
        <div className="u4-form" style={{ transform: `translateY(${-v.scroll * 430}px)` }}>
          <StepH n={1} t="¿A quién vas a invitar?" s="Elige uno de tu catálogo o crea uno nuevo." />
          <div className="ua-card u4-pick">
            <Avatar t="+" size={48} />
            <div style={{ flex: 1 }}>
              <div className="u4-row-t">Elegir de mis visitantes</div>
              <div className="u4-row-s">Toca para abrir el catálogo</div>
            </div>
            <I4.chev c="#64748B" />
          </div>
          <StepH n={2} t="Datos del visitante" s="Nombre completo (obligatorio). Documento y teléfono ayudan al celador a verificar la identidad sin foto." />
          <Field label="Nombre completo" value={v.name} focus={v.focus === "name"} />
          <Field label="Documento (opcional)" value={v.doc} focus={v.focus === "doc"} />
          <Field label="Teléfono (opcional)" value="" />
          <StepH n={3} t="Razón de la visita" s="Elige una de las tres opciones." />
          <div className="u4-chips">
            <Chip l="Invitado" ic={<I4.person s={16} />} on />
            <Chip l="Domicilio" ic={<I4.moto s={16} />} />
            <Chip l="Servicio" ic={<I4.tool s={16} />} />
          </div>
          <StepH n={4} t="Vehículo (opcional)" s="Marca esta sección si el visitante viene en un vehículo." />
          <div className="ua-card u4-switch">
            <I4.car c="#94A3B8" />
            <span style={{ flex: 1 }}>¿Viene en vehículo?</span>
            <i className="u4-sw" />
          </div>
          <StepH n={5} t="Fecha y hora" s="Si lo dejas en blanco, la invitación se activa ahora y vence 30 min después." />
          <div className="ua-card u4-sched">
            <div><span className="u4-lt-t">Fecha</span><b>Hoy (predeterminado)</b></div>
            <I4.calendar c={BLUE} />
          </div>
          <div className="ua-card u4-sched" style={{ marginTop: -14, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
            <div><span className="u4-lt-t">Hora</span><b>Ahora (predeterminado)</b></div>
            <I4.time c={BLUE} />
          </div>
          <Btn label="Generar invitación" pressed={v.press} loading={v.loading} />
          <div className="u4-foot">La invitación se envía a los celadores en turno y aparece en el panel de Ingresos. El visitante solo podrá entrar desde la hora programada y por 30 min después.</div>
        </div>
      </div>
    </div>
  );
}

function TL({ title, sub, time, done, c, last }: { title: string; sub: string; time?: string; done: boolean; c: string; last?: boolean }) {
  return (
    <div className="u4-tl">
      <div className="u4-tl-l">
        <i style={{ background: done ? c : "transparent", borderColor: c }} />
        {!last && <span />}
      </div>
      <div className="u4-tl-b">
        <div className="u4-tl-h">
          <b>{title}</b>
          {time && <span>{time}</span>}
        </div>
        <div className="u4-tl-s">{sub}</div>
      </div>
    </div>
  );
}
function StatusScreen({ v }: { v: Extract<PhoneView4, { s: "status" }> }) {
  const wait = v.stage === "wait";
  const time = wait ? "16:52" : v.stage === "inside" ? "17:00" : EXIT_HM;
  return (
    <div className="ua-screen">
      <StatusBar time={time} />
      <AppBar title="Estado de la invitación" back />
      <div className="u4-st">
        <div className="u4-c"><span className="ua-live u4-livedot"><i /> {DEMO.carlos} en turno</span></div>
        <div className="u4-c"><Avatar t={ANDRES.initials} size={64} /></div>
        <div className="u4-st-n">{ANDRES.name}</div>
        <div className="u4-c">
          {wait ? (
            <span className="u4-bigb" style={{ color: BLUE, background: `${BLUE}26`, borderColor: `${BLUE}66` }}><I4.hourglass s={16} /> Esperando al visitante</span>
          ) : (
            <span className="u4-bigb" style={{ color: OK, background: `${OK}26`, borderColor: `${OK}66` }}><I4.check s={16} /> Visita completada</span>
          )}
        </div>
        <div className="ua-card u4-tlc">
          <TL title="Invitación generada" sub="Enviada a los celadores en turno" time="16:52" done c={OK} last={false} />
          {wait ? (
            <TL title="Esperando llegada" sub="Cuando el visitante llegue, la portería autoriza la entrada" done={false} c={BLUE} last />
          ) : (
            <>
              <TL title="Visitante adentro" sub={`Autorizó ${DEMO.carlos}`} time={ENTRY_HM} done c={OK} />
              {v.stage === "inside" ? (
                <TL title="En curso" sub="El visitante todavía está en el conjunto" done={false} c={BLUE} last />
              ) : (
                <TL title="Visitante salió" sub={`Salida registrada por ${DEMO.carlos}`} time={EXIT_HM} done c={OK} last />
              )}
            </>
          )}
        </div>
        {wait && (
          <>
            <Btn label="Llamar al celador" icon={<I4.callIn s={18} />} />
            <div className="u4-ghost"><I4.cancel s={18} /> Cancelar invitación</div>
          </>
        )}
      </div>
      {v.stage !== "out" ? (
        <Notif k={v.notif} title="Tu invitado ingresó" body={`${ANDRES.name} entró al conjunto a las ${ENTRY_HM} autorizado por ${DEMO.carlos}`} />
      ) : (
        <Notif k={v.notif} title="Tu invitado salió" body={`${ANDRES.name} salió del conjunto a las ${EXIT_HM}, registrado por ${DEMO.carlos}.`} />
      )}
    </div>
  );
}

export function PhoneScreen4({ v }: { v: PhoneView4 }) {
  let body: ReactNode;
  if (v.s === "list") body = <ListScreen v={v} />;
  else if (v.s === "form") body = <FormScreen v={v} />;
  else body = <StatusScreen v={v} />;
  return (
    <div className="ua-phone">
      <div className="ua-notch" />
      <div className="ua-phone-in">{body}</div>
    </div>
  );
}

/* ======================= Centro de control ======================= */
export function GBadge({ l, c, ic }: { l: string; c: string; ic?: ReactNode }) {
  return (
    <span className="u4-gb" style={{ color: c, background: `${c}26` }}>
      {ic}
      {l}
    </span>
  );
}
export function GField({ ic, l, v }: { ic?: ReactNode; l: string; v: string }) {
  return (
    <div className="u4-gf">
      <p className="u4-gf-l">{ic}{l}</p>
      <p className="u4-gf-v">{v}</p>
    </div>
  );
}

function Row({ inside, sel, press, t }: { inside: boolean; sel: boolean; press: boolean; t: number }) {
  return (
    <li className={`u4-grow ${sel ? "is-sel" : ""} ${press ? "is-press" : ""}`}>
      <span className="u4-gini">{ANDRES.initials}</span>
      <div className="u4-gcol">
        <p className="u4-gname">{ANDRES.name}</p>
        <GBadge l="Invitado" c={INFO} />
      </div>
      <div className="u4-gcol">
        <p className="u4-gloc"><I4.pin c={MUTED} /> Torre A · Apto 501</p>
        <p className="u4-gres"><L.user s={12} c={MUTED} /> {DEMO.maria} <GBadge l="Propietario" c={BLUE} /></p>
      </div>
      <div className="u4-gcol">
        {inside ? (
          <>
            <p className="u4-gtime" style={{ color: OK }}><L.logIn s={12} /> <b>Entró {ENTRY_HM}</b></p>
            <p className="u4-gsub"><GBadge l="Por invitación" c={OK} /> Por {DEMO.carlos}</p>
            <p className="u4-gsub"><L.logOut s={11} /> Salida pendiente</p>
          </>
        ) : (
          <>
            <p className="u4-gtime"><L.clock s={12} c={MUTED} /> <b>{`${WIN4.start} - ${WIN4.end}`}</b></p>
            <p className="u4-gsub"><L.logOut s={11} /> Pendiente de ingreso</p>
          </>
        )}
      </div>
      {!sel && (
        <div className="u4-gcol u4-gexp">
          <p className="u4-gf-l">Expira en</p>
          <p className="u4-gexp-v">{inside ? "—" : <><I4.hourglass s={12} /> {expiresIn(t)}</>}</p>
        </div>
      )}
      <GBadge l={inside ? "Dentro" : "En ventana"} c={OK} />
    </li>
  );
}

function Detail({ inside, press, busy }: { inside: boolean; press: boolean; busy: boolean }) {
  return (
    <div className="u4-det">
      <div className="u4-card">
        <div className="u4-vh">
          <span className="u4-gini u4-gini-l">{ANDRES.initials}</span>
          <div>
            <p className="u4-gf-l">Visitante</p>
            <p className="u4-vname">{ANDRES.name}</p>
            <div className="u4-vb">
              {inside ? <GBadge l="Dentro" c={OK} /> : <GBadge l="Activa" c={WARN} />}
              <GBadge l="Invitado" c={INFO} />
            </div>
          </div>
        </div>
        <div className="u4-g3">
          <GField ic={<I4.idc />} l="Documento" v={ANDRES.doc} />
          <GField ic={<L.phone s={12} />} l="Teléfono" v="—" />
          <GField ic={<I4.car s={12} />} l="Placa" v="—" />
        </div>
        {inside && (
          <div className="u4-g3 u4-ing">
            <p className="u4-gf-l" style={{ gridColumn: "1 / -1", marginBottom: -6 }}>Ingreso</p>
            <GField ic={<L.logIn s={12} />} l="Hora de entrada" v={ENTRY_12} />
            <GField ic={<I4.shield />} l="Método" v="Por invitación" />
            <GField ic={<L.user s={12} />} l="Autorizado por" v={DEMO.carlos} />
          </div>
        )}
      </div>
      <div className="u4-card">
        <div className="u4-rh">
          <div>
            <p className="u4-gf-l">Residente que invitó</p>
            <p className="u4-rname">{DEMO.maria}</p>
          </div>
          <span className="u4-pres"><i /> Conectado</span>
        </div>
        <div className="u4-g2">
          <GField ic={<L.phone s={12} />} l="Teléfono" v={MARIA4.phone} />
          <GField ic={<L.user s={12} />} l="Identificador" v={MARIA4.userId} />
        </div>
      </div>
      <div className="u4-card">
        <p className="u4-gf-l">Apartamento</p>
        <div className="u4-g3">
          <GField ic={<L.building s={12} />} l="Torre" v={MARIA4.tower} />
          <GField ic={<I4.door s={12} />} l="Apto" v={MARIA4.apto} />
          <GField ic={<I4.hash />} l="Piso" v={MARIA4.floor} />
        </div>
      </div>
      <div className="u4-card">
        <p className="u4-gf-l">Programación</p>
        <div className="u4-g2">
          <GField ic={<L.cal s={12} />} l="Fecha" v={DATE_LONG4} />
          <GField ic={<L.clock s={12} />} l="Ventana horaria" v={`${WIN4.start} – ${WIN4.end}`} />
        </div>
      </div>
      {inside ? (
        <>
          <span className={`u4-gbtn is-sec ${press ? "is-press" : ""}`}>{busy ? <span className="ua-spin" /> : <><L.logOut s={18} /> Permitir salida</>}</span>
          <p className="u4-hint">El visitante está dentro. Presiona &quot;Permitir salida&quot; cuando se retire para cerrar su ingreso y abrir la puerta.</p>
        </>
      ) : (
        <>
          <span className={`u4-gbtn ${press ? "is-press" : ""}`}>{busy ? <span className="ua-spin" /> : <><I4.door s={18} /> Permitir ingreso</>}</span>
          <span className="u4-gbtn is-ghost"><I4.x /> Denegar entrada</span>
        </>
      )}
    </div>
  );
}

function Dialog({ exit, confirm, busy }: { exit: boolean; confirm: boolean; busy: boolean }) {
  return (
    <div className="u4-dlg-bg">
      <div className="u4-dlg">
        <div className="u4-dlg-ic">{exit ? <L.logOut s={26} /> : <I4.door s={26} />}</div>
        <h2>{exit ? "¿Permitir salida?" : "¿Permitir ingreso?"}</h2>
        <p>{exit ? "Vas a cerrar el acceso del visitante y abrir la puerta de salida. La invitación pasará al historial." : "Vas a abrir la puerta y registrar la entrada del visitante. Esta acción queda en bitácora."}</p>
        <div className="u4-dlg-a">
          <span className="u4-gbtn is-ghost is-sm">Cancelar</span>
          <span className={`u4-gbtn is-sm ${confirm ? "is-press" : ""}`}>
            {busy ? <span className="ua-spin" /> : <>{exit ? <L.logOut s={16} /> : <I4.door s={16} />} {exit ? "Sí, permitir salida" : "Sí, permitir ingreso"}</>}
          </span>
        </div>
      </div>
    </div>
  );
}

export function GuardPanel4({ v, compact }: { v: GuardView4; compact: boolean }) {
  const exits = v.page === "exits";
  const now = clock4(v.t).h12pad;
  const empty = v.done;
  return (
    <div className="uw-win">
      <div className="uw-chrome">
        <i /><i /><i />
        <span className="uw-url">{exits ? "/guardstation/exits" : "/guardstation/access"}</span>
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
                  <div key={l} className={`ug-nav-i ${l === (exits ? "Salidas" : "Ingresos") ? "on" : ""}`}>
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
              <div className="uw-muted" style={{ fontSize: 11 }}>Turno Tarde · {DATE_GUARD4}</div>
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
            <div className="u4-ph">
              <span className="uw-ph-ic">{exits ? <L.logOut s={22} /> : <L.logIn s={22} />}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1>{exits ? "Salidas" : "Ingresos"}</h1>
                <p>{exits ? "Visitantes actualmente dentro del conjunto. Selecciona uno para registrar la salida." : "Invitaciones pendientes para hoy. Cuando autorices el ingreso, la invitación se moverá a Salidas."}</p>
              </div>
              {!compact &&
                (v.sel ? (
                  <span className="u4-hbtn is-ghost"><I4.x s={14} /> Cerrar detalle</span>
                ) : !exits ? (
                  <span className="u4-hbtn"><L.userPlus s={16} /> Registrar visitante</span>
                ) : null)}
            </div>
            <div className="u4-search"><I4.search c={MUTED} /> <span>Buscar por nombre, apto o residente…</span></div>
            <div className={`u4-split ${v.sel ? "is-sel" : ""}`}>
              {!(compact && v.sel) && (
                <section className="u4-list">
                  {empty ? (
                    <div className="u4-gempty">
                      <b>{exits ? "No hay visitantes adentro" : "No hay invitaciones esperando ingreso"}</b>
                      <span>{exits ? "Cuando alguien ingrese aparecerá aquí para que registres su salida." : "Las nuevas invitaciones aparecerán aquí automáticamente."}</span>
                    </div>
                  ) : (
                    <>
                      <p className="u4-sec">
                        <b style={{ color: exits ? OK : MUTED }}>{exits ? "Dentro del conjunto" : "Pendientes de ingreso"}</b> <span>(1)</span>
                      </p>
                      <ul className="u4-rows-g">
                        <Row inside={exits} sel={v.sel} press={v.press === 1} t={v.t} />
                      </ul>
                    </>
                  )}
                </section>
              )}
              {v.sel && <Detail inside={exits} press={v.press === 2} busy={false} />}
            </div>
          </div>
        </div>
        {v.dialog && <Dialog exit={exits} confirm={v.confirm} busy={v.busy} />}
      </div>
    </div>
  );
}
