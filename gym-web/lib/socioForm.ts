export const EMPTY_SOCIO_FORM = {
  docTipo: "CC",
  docNumero: "",
  nombre: "",
  fechaNac: "",
  genero: "",
  codigoPais: "57",
  celular: "",
  email: "",
  enviarEmails: true,
  direccion: "",
  prospecto: false,
  empresa: "",
  contactoRespaldoNombre: "",
  contactoRespaldoTel: "",
  observaciones: "",
};

export type SocioFormData = typeof EMPTY_SOCIO_FORM;

export const fieldCls =
  "rounded-xl border border-gym-border bg-gym-navy/80 px-3.5 py-2.5 text-sm text-gym-silver outline-none transition-colors focus:border-gym-primary placeholder:text-gym-muted/60";
export const inputCls = `w-full ${fieldCls}`;
export const labelCls = "text-xs font-semibold text-gym-muted";
