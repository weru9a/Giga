Deno.serve(async (request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { authKey, text } = await request.json();

    if (!authKey || !text) {
      return new Response(JSON.stringify({ error: "Missing authKey or text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = Deno.createHttpClient({ allowInsecure: true });

    const authResponse = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "RqUID": crypto.randomUUID(),
        "Authorization": `Basic ${authKey}`
      },
      body: "scope=GIGACHAT_API_PERS",
      client: client
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      return new Response(JSON.stringify({ error: `Auth failed: ${errorText}` }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();

    const chatResponse = await fetch("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${authData.access_token}`
      },
      body: JSON.stringify({
        model: "GigaChat",
        messages: [
          { role: "system", content: "Ты — Saturn AI, полезный ассистент в редакторе кода. Отвечай кратко на русском. Код — в ```lua``` / ```java``` / ```js```." },
          { role: "user", content: text }
        ],
        temperature: 0.6,
        max_tokens: 1024
      }),
      client: client
    });

    const chatData = await chatResponse.text();

    return new Response(chatData, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
