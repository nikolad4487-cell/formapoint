export type WebmailMailbox = { address: string; status: 'created' | 'existing'; loginUrl: string };
export async function provisionWebmail(
  accessToken: string,
  signal: AbortSignal,
): Promise<WebmailMailbox> {
  const response = await fetch('/api/webmail-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: '{}',
    signal,
  });
  if (!response.ok) throw new Error('Sandučić trenutačno nije dostupan. Pokušajte ponovno.');
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('address' in result) ||
    typeof result.address !== 'string' ||
    !('status' in result) ||
    !['created', 'existing'].includes(String(result.status)) ||
    !('loginUrl' in result) ||
    result.loginUrl !== 'https://webmailhr.com'
  )
    throw new Error('Povezivanje sandučića nije potvrđeno.');
  return result as WebmailMailbox;
}
