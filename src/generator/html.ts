// Tekst veilig in HTML zetten (S-087). De teksten komen uit content/ (Keystatic); een < of " daarin mag de pagina
// niet breken en nooit als HTML of script gelezen worden.

const teken: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Voor tekst die via innerHTML in de pagina komt, ook binnen een attribuut. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => teken[c]);

// De regelscheidingen U+2028 en U+2029, en <: als code geschreven, zodat ze nooit letterlijk in het blok staan.
const lastig = new RegExp('[<' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/** JSON voor in <script type="application/json">: zonder <, zodat een tekst met </script> het blok niet sluit. */
export const jsonScript = (data: unknown): string =>
  JSON.stringify(data).replace(lastig, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
