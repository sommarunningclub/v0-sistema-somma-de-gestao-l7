/**
 * Wrapper de fetch para chamadas autenticadas ao backend.
 * Envia cookies de sessão HttpOnly automaticamente.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
  })
}
