const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function connectDevice(deviceId) {
  const response = await fetch(`${API_URL}/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function listDevices() {
  const response = await fetch(`${API_URL}/devices`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function disconnectDevice(deviceId) {
  const response = await fetch(`${API_URL}/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function connectAllDevices() {
  const response = await fetch(`${API_URL}/connect-all`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function startJob(deviceId) {
  const response = await fetch(`${API_URL}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function testU2OpenSettings(deviceId) {
  const response = await fetch(`${API_URL}/u2/test-open-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
