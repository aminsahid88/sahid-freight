const WAAFI_BASE_URL = 'https://api.waafipay.net/asm';
const WAAFI_MERCHANT_UID = process.env.WAAFI_MERCHANT_UID || '';
const WAAFI_API_USER_ID = process.env.WAAFI_API_USER_ID || '';
const WAAFI_API_KEY = process.env.WAAFI_API_KEY || '';

export async function initializeWaafiPayment({
  amount,
  phone,
  description,
  referenceId,
}: {
  amount: number;
  phone: string;
  description: string;
  referenceId: string;
}) {
  const payload = {
    schemaVersion: '1.0',
    requestId: referenceId,
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid: WAAFI_MERCHANT_UID,
      apiUserId: WAAFI_API_USER_ID,
      apiKey: WAAFI_API_KEY,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: { accountNo: phone },
      transactionInfo: {
        referenceId,
        invoiceId: referenceId,
        amount: amount.toString(),
        currency: 'USD',
        description,
      },
    },
  };

  const response = await fetch(WAAFI_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Waafi init failed: ${err}`);
  }

  return response.json() as Promise<any>;
}

export async function checkWaafiPayment(referenceId: string) {
  const payload = {
    schemaVersion: '1.0',
    requestId: referenceId,
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PAYMENT_STATUS',
    serviceParams: {
      merchantUid: WAAFI_MERCHANT_UID,
      apiUserId: WAAFI_API_USER_ID,
      apiKey: WAAFI_API_KEY,
      transactionInfo: { referenceId },
    },
  };

  const response = await fetch(WAAFI_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Waafi check failed: ${err}`);
  }

  return response.json() as Promise<any>;
}
