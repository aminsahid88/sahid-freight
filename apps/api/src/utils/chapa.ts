const CHAPA_BASE_URL = 'https://api.chapa.co/v1';
const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY || '';

export async function initializeChapaPayment({
  amount,
  currency,
  email,
  firstName,
  lastName,
  phone,
  txRef,
  callbackUrl,
  returnUrl,
  description,
}: {
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
  description: string;
}) {
  const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CHAPA_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phone,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      description,
      customization: {
        title: 'Sahid Freight',
        description,
        logo: 'https://sahidfreight.com/logo.svg',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chapa init failed: ${err}`);
  }

  return response.json() as Promise<any>;
}

export async function verifyChapaPayment(txRef: string) {
  const response = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${txRef}`, {
    headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chapa verify failed: ${err}`);
  }

  return response.json() as Promise<any>;
}
