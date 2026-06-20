export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    const signature = request.headers.get("x-signature-ed25519");
    const timestamp = request.headers.get("x-signature-timestamp");
    const rawBody = await request.text();

    if (!signature || !timestamp) {
      return json({ error: "Missing signature headers" }, 401);
    }

    if (!isFreshTimestamp(timestamp)) {
      return json({ error: "Stale timestamp" }, 401);
    }

    const validSignature = await verifyDiscordSignature({
      publicKeyHex: env.DISCORD_PUBLIC_KEY,
      signatureHex: signature,
      timestamp,
      rawBody,
    });

    if (!validSignature) {
      return json({ error: "Invalid request signature" }, 401);
    }

    let interaction;
    try {
      interaction = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (interaction.type === 1) {
      return json({ type: 1 }, 200);
    }

    if (interaction.type === 2 && interaction.data?.name === "setup") {
      if (!isGuildAdmin(interaction)) {
        return json({
          type: 4,
          data: { content: "Only server admins can run /setup in guilds.", flags: 64 },
        }, 200);
      }

      return json({
        type: 9,
        data: {
          custom_id: "setup_modal",
          title: "Setup GAS",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "gasWebhookUrl",
                  label: "GAS Webhook URL",
                  style: 1,
                  required: true,
                  placeholder: "https://script.google.com/macros/s/.../exec",
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "proxyToken",
                  label: "PROXY_TOKEN",
                  style: 1,
                  required: true,
                  placeholder: "32+ random chars",
                },
              ],
            },
          ],
        },
      }, 200);
    }

    if (interaction.type === 5 && interaction.data?.custom_id === "setup_modal") {
      const gasWebhookUrl = getModalValue(interaction, "gasWebhookUrl");
      const proxyToken = getModalValue(interaction, "proxyToken");

      if (!isValidGasWebhookUrl(gasWebhookUrl)) {
        return json({
          type: 4,
          data: { content: "Invalid GAS_WEBHOOK_URL format.", flags: 64 },
        }, 200);
      }

      if (proxyToken.length < 32) {
        return json({
          type: 4,
          data: { content: "PROXY_TOKEN must be 32+ chars.", flags: 64 },
        }, 200);
      }

      const key = getSettingsKey(interaction);
      await saveSettings(env, key, { gasWebhookUrl, proxyToken });

      return json({
        type: 4,
        data: { content: "Setup saved.", flags: 64 },
      }, 200);
    }

    if (interaction.type === 2 && interaction.data?.name === "setup_clear") {
      if (!isGuildAdmin(interaction)) {
        return json({
          type: 4,
          data: { content: "Only server admins can run /setup_clear in guilds.", flags: 64 },
        }, 200);
      }

      const key = getSettingsKey(interaction);
      await env.SETTINGS_KV.delete(key);

      return json({
        type: 4,
        data: { content: "Setup cleared.", flags: 64 },
      }, 200);
    }

    if (interaction.type === 2 && interaction.data?.name === "notify_setup") {
      return json({
        type: 9,
        data: {
          custom_id: "notify_setup_modal",
          title: "Notification Setup",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "discordWebhookUrl",
                  label: "Discord Webhook URL",
                  style: 1,
                  required: true,
                  placeholder: "https://discord.com/api/webhooks/...",
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "notifyTime",
                  label: "Notify Time",
                  style: 1,
                  required: true,
                  placeholder: "Example: 08:00",
                },
              ],
            },
          ],
        },
      }, 200);
    }

    if (interaction.type === 2 && interaction.data?.name === "schedule_add") {
      return json({
        type: 9,
        data: {
          custom_id: "schedule_add_modal",
          title: "Add Schedule",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "title",
                  label: "Title",
                  style: 1,
                  required: true,
                  placeholder: "Example: Meeting",
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "date",
                  label: "Date",
                  style: 1,
                  required: true,
                  placeholder: "Example: 2026-05-27",
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "startTime",
                  label: "Start Time",
                  style: 1,
                  required: true,
                  placeholder: "Example: 13:00",
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "durationMinutes",
                  label: "Duration Minutes",
                  style: 1,
                  required: true,
                  placeholder: "Example: 60",
                },
              ],
            },
          ],
        },
      }, 200);
    }

    ctx.waitUntil(
      processInteractionInBackground({
        env,
        interaction,
      })
    );

    return json(
      {
        type: 5,
        data: { flags: 64 },
      },
      200
    );
  },
};

async function processInteractionInBackground({ env, interaction }) {
  const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`;

  try {
    const key = getSettingsKey(interaction);
    const settings = await loadSettings(env, key);
    if (!settings?.gasWebhookUrl || !settings?.proxyToken) {
      await postFollowup(followupUrl, "Setup not found. Run /setup first.", true);
      return;
    }

    const gasResponse = await fetch(settings.gasWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proxyToken: settings.proxyToken,
        interaction,
      }),
    });

    if (!gasResponse.ok) {
      await postFollowup(followupUrl, "GAS request failed.", true);
      return;
    }

    const result = await gasResponse.json();
    const content = typeof result?.content === "string" ? result.content : "Done.";
    const ephemeral = Number(result?.flags) === 64;

    await postFollowup(followupUrl, content, ephemeral);
  } catch (error) {
    await postFollowup(followupUrl, `Worker error: ${String(error)}`, true);
  }
}

async function postFollowup(url, content, ephemeral) {
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      flags: ephemeral ? 64 : undefined,
    }),
  });
}

function isFreshTimestamp(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }
  return Math.abs(now - ts) <= 300;
}

async function verifyDiscordSignature({ publicKeyHex, signatureHex, timestamp, rawBody }) {
  if (!publicKeyHex) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(publicKeyHex),
    { name: "Ed25519" },
    false,
    ["verify"]
  );

  const body = new TextEncoder().encode(timestamp + rawBody);

  return crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    hexToBytes(signatureHex),
    body
  );
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }

  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
    },
  });
}

function getSettingsKey(interaction) {
  if (interaction.guild_id) {
    return `guild:${interaction.guild_id}`;
  }
  if (interaction.user?.id || interaction.member?.user?.id) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    return `user:${userId}`;
  }
  throw new Error("Cannot resolve settings key");
}

function getModalValue(interaction, customId) {
  const rows = interaction.data?.components ?? [];
  for (const row of rows) {
    const component = row.components?.find((item) => item.custom_id === customId);
    if (component?.value) return component.value;
  }
  throw new Error(`Missing modal field: ${customId}`);
}

function isValidGasWebhookUrl(url) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url);
}

function isGuildAdmin(interaction) {
  if (!interaction.guild_id) return true;
  const permissions = interaction.member?.permissions;
  if (!permissions) return false;
  const ADMINISTRATOR = 1n << 3n;
  return (BigInt(permissions) & ADMINISTRATOR) === ADMINISTRATOR;
}

async function saveSettings(env, key, settings) {
  const jsonText = JSON.stringify(settings);
  const encrypted = await encryptText(jsonText, env.SETTINGS_ENCRYPTION_KEY);
  await env.SETTINGS_KV.put(key, JSON.stringify(encrypted));
}

async function loadSettings(env, key) {
  const raw = await env.SETTINGS_KV.get(key, "text");
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (isEncryptedPayload(parsed)) {
    const decrypted = await decryptText(parsed, env.SETTINGS_ENCRYPTION_KEY);
    return JSON.parse(decrypted);
  }

  if (parsed?.gasWebhookUrl && parsed?.proxyToken) {
    return parsed;
  }

  return null;
}

function isEncryptedPayload(value) {
  return Boolean(
    value &&
    value.v === 1 &&
    value.alg === "A256GCM" &&
    typeof value.iv === "string" &&
    typeof value.data === "string"
  );
}

async function encryptText(plainText, keyB64) {
  const cryptoKey = await importEncryptionKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(plainText);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plainBytes
  );

  return {
    v: 1,
    alg: "A256GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipherBuffer)),
  };
}

async function decryptText(payload, keyB64) {
  const cryptoKey = await importEncryptionKey(keyB64);
  const iv = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.data);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuffer);
}

async function importEncryptionKey(keyB64) {
  if (!keyB64) {
    throw new Error("Missing SETTINGS_ENCRYPTION_KEY");
  }

  const keyBytes = base64ToBytes(keyB64);
  if (keyBytes.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be base64 of 32 bytes");
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
