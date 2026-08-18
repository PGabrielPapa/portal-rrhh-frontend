// Escape de HTML para las ventanas de impresión.
//
// Las pantallas de impresión (certificados, sanciones, boletas sindicales, recibos)
// arman el documento con `document.write` y plantillas de texto. Si un valor de la
// base contiene HTML —y varios campos son texto libre cargado por RR.HH. o por el
// propio empleado (descripción de una sanción, nombre, destinatario del certificado,
// nombre de un sindicato)— ese HTML se ejecuta en la ventana nueva. Como la ventana
// conserva `window.opener` hacia el portal, un `<img onerror=…>` alcanzaba para
// leer el token del `localStorage` y quedarse con la sesión.
//
// `esc` se usa para texto que va dentro del documento; `escAttr` para valores que
// van dentro de un atributo entre comillas (además de `<`/`>` hay que neutralizar
// la comilla que cerraría el atributo).

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export const escAttr = esc;

/**
 * Sanea una URL para usar en `src`/`href`. Solo deja pasar imágenes embebidas
 * (`data:image/...`), https y rutas relativas del propio portal: así un logo o
 * una firma guardados en la base no pueden convertirse en `javascript:...`.
 */
export function escUrl(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]*$/i.test(s)) return esc(s);
  if (/^https:\/\//i.test(s) || /^\/[^/]/.test(s)) return esc(s);
  return '';
}
